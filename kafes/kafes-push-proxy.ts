// kafes push proxy. See README.md#push-proxy.
//
// Forwards Git push and fetch for one repository to github.com, adding a
// short-lived GitHub App installation token. Every other request gets 403.
// The workshop never sees a GitHub credential.
//
// Run on the host by `kafes`, as a systemd user unit in ~/kafes/sandbox:
//   ~/.bun/bin/bun --no-env-file --config=./bunfig.toml ./kafes-push-proxy.ts
// --no-env-file and an explicit, settings-free bunfig.toml stop Bun loading a
// .env or a preloading bunfig.toml from the current directory. Keep the `=` in
// --config=: the space-separated form exits silently without starting.

import { createPrivateKey, sign, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const REPO = required("KAFES_PUSH_REPO");
const CLIENT_ID = required("KAFES_APP_CLIENT_ID");
const INSTALLATION_ID = required("KAFES_APP_INSTALLATION_ID");
const clientToken = readFileSync(
  process.env.KAFES_PUSH_CLIENT_TOKEN_FILE ??
    `${homedir()}/.config/kafes/push/client.token`,
  "utf8"
).trim();
if (!/^[a-f0-9]{64}$/.test(clientToken)) {
  throw new Error("Proxy client token must be 32 random bytes in hex");
}
const CLIENT_AUTHORIZATION = Buffer.from(`Bearer ${clientToken}`);
const KEY = createPrivateKey(
  readFileSync(
    process.env.KAFES_APP_KEY ?? `${homedir()}/.config/kafes/push/app.pem`
  )
);
if (!/^[\w.-]+\/[\w.-]+$/.test(REPO)) {
  throw new Error("KAFES_PUSH_REPO must be <owner>/<repo>");
}

const API = "https://api.github.com";
const GIT = "https://github.com";
const API_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 5 * 60_000;
const MAX_ACTIVE_REQUESTS = 4;
const API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "kafes-push-proxy",
};

// The only requests Git smart HTTP needs for push and fetch. Matched exactly,
// after URL normalization, so encoded or extra path segments are refused.
const ALLOWED = new Set([
  `GET /${REPO}.git/info/refs?service=git-upload-pack`,
  `GET /${REPO}.git/info/refs?service=git-receive-pack`,
  `POST /${REPO}.git/git-upload-pack`,
  `POST /${REPO}.git/git-receive-pack`,
]);

// Headers passed through. Anything else, including the workshop's own
// Authorization header, is dropped.
const REQUEST_HEADERS = [
  "accept",
  "content-encoding",
  "content-type",
  "git-protocol",
  "user-agent",
];
const RESPONSE_HEADERS = ["cache-control", "content-type", "expires", "pragma"];

// --- Installation token ---------------------------------------------------

let token: { value: string; expiresAt: number } | undefined;
let minting: Promise<string> | undefined;
let mintFailed = false;
const liveTokens = new Map<string, number>();
const stopping = new AbortController();
let activeRequests = 0;

// Reuse the token until it has under 10 minutes left; one mint at a time.
async function currentToken(): Promise<string> {
  stopping.signal.throwIfAborted();
  if (token && token.expiresAt - Date.now() > 10 * 60_000) {
    return token.value;
  }
  minting ??= mintToken()
    .catch((error: unknown) => {
      mintFailed = true;
      console.error("Token mint failed; revocation may be incomplete");
      throw error;
    })
    .finally(() => (minting = undefined));
  return minting;
}

async function mintToken(): Promise<string> {
  const res = await fetch(
    `${API}/app/installations/${INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { ...API_HEADERS, Authorization: `Bearer ${appJwt()}` },
      // Narrowed to one repository and contents:write, whatever the App has.
      body: JSON.stringify({
        repositories: [REPO.split("/")[1]],
        permissions: { contents: "write" },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`token request failed: HTTP ${res.status}`);
  }
  const data: unknown = await res.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("token" in data) ||
    typeof data.token !== "string" ||
    !data.token
  ) {
    throw new Error("Invalid installation token response");
  }
  const value = data.token;
  // Retain even a token with malformed expiry metadata so shutdown revokes it.
  liveTokens.set(value, Number.POSITIVE_INFINITY);
  const expiresAt =
    "expires_at" in data && typeof data.expires_at === "string"
      ? Date.parse(data.expires_at)
      : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Invalid installation token expiry");
  }
  liveTokens.set(value, expiresAt);
  for (const [oldToken, expiry] of liveTokens) {
    if (expiry <= Date.now()) liveTokens.delete(oldToken);
  }
  token = { value, expiresAt };
  return value;
}

// GitHub App JWT: RS256, valid for 9 minutes, backdated 60 s for clock skew.
function appJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    { alg: "RS256", typ: "JWT" },
    { iat: now - 60, exp: now + 540, iss: CLIENT_ID },
  ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".");
  const signature = sign("sha256", Buffer.from(unsigned), KEY);
  return `${unsigned}.${signature.toString("base64url")}`;
}

// Signals can arrive more than once; every one waits on the same revocation.
let shutdown: Promise<never> | undefined;
let exitCode = 0;
function revokeAndExit(failed = false): Promise<never> {
  if (failed) exitCode = 1;
  shutdown ??= (async () => {
    stopping.abort();
    const stopped = server.stop(true);
    // Let an already-issued mint finish; aborting it could lose the new token.
    try {
      await minting;
    } catch {
      // currentToken already recorded and reported this failure.
    }
    if (mintFailed) exitCode = 1;
    await Promise.all(
      [...liveTokens]
        .filter(([, expiry]) => expiry > Date.now())
        .map(async ([value]) => {
          try {
            const res = await fetch(`${API}/installation/token`, {
              method: "DELETE",
              headers: { ...API_HEADERS, Authorization: `Bearer ${value}` },
              redirect: "error",
              signal: AbortSignal.timeout(API_TIMEOUT_MS),
            });
            await res.body?.cancel();
            if (res.status !== 204) {
              throw new Error(`HTTP ${res.status}`);
            }
            liveTokens.delete(value);
            console.log("Installation token revoked");
          } catch {
            exitCode = 1;
            console.error(
              "Token revocation failed; token may live until expiry"
            );
          }
        })
    );
    await stopped;
    process.exit(exitCode);
  })();
  return shutdown;
}

// --- Forwarding -----------------------------------------------------------

async function forward(
  request: Request,
  target: string,
  signal: AbortSignal,
  release: () => void
): Promise<Response> {
  const headers = pick(request.headers, REQUEST_HEADERS);
  const credentials = Buffer.from(
    `x-access-token:${await currentToken()}`
  ).toString("base64");
  headers.set("authorization", `Basic ${credentials}`);
  signal.throwIfAborted();

  const upstream = await fetch(`${GIT}${target}`, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual", // never carry the token to another location
    signal,
  });
  if (!upstream.body) {
    release();
    return new Response(null, {
      status: upstream.status,
      headers: pick(upstream.headers, RESPONSE_HEADERS),
    });
  }
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  // pipeTo preserves backpressure and propagates aborts and client cancellation.
  void upstream.body
    .pipeTo(writable, { signal })
    .catch(() => console.error("Upstream response stream interrupted"))
    .finally(release);
  return new Response(readable, {
    status: upstream.status,
    headers: pick(upstream.headers, RESPONSE_HEADERS),
  });
}

function pick(from: Headers, names: string[]): Headers {
  const picked = new Headers();
  for (const name of names) {
    const value = from.get(name);
    if (value !== null) picked.set(name, value);
  }
  return picked;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// --- Server ---------------------------------------------------------------

// Git clients send these; a browser page can't send a POST with them without
// a CORS preflight, which this proxy never answers.
const GIT_CONTENT_TYPES = new Set([
  "application/x-git-upload-pack-request",
  "application/x-git-receive-pack-request",
]);
const HOSTS = new Set(["localhost:4100", "127.0.0.1:4100"]);

// Authentication is separate from the browser and DNS-rebinding guards.
function refusal(request: Request): string | undefined {
  if (!HOSTS.has(request.headers.get("host") ?? "")) return "bad host";
  if (request.headers.has("origin")) return "browser origin";
  const authorization = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    authorization.length !== CLIENT_AUTHORIZATION.length ||
    !timingSafeEqual(authorization, CLIENT_AUTHORIZATION)
  ) {
    return "bad client credential";
  }
  const type = request.headers.get("content-type") ?? "";
  if (request.method === "POST" && !GIT_CONTENT_TYPES.has(type)) {
    return "not a Git request";
  }
  return undefined;
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4100,
  idleTimeout: 255, // GitHub can take a while to answer large pushes
  maxRequestBodySize: 2 * 1024 ** 3, // GitHub's push size limit
  async fetch(request) {
    if (stopping.signal.aborted) {
      return new Response("shutting down\n", { status: 503 });
    }
    const url = new URL(request.url);
    const target = `${url.pathname}${url.search}`;
    const line = `${request.method} ${target}`;
    const refused = ALLOWED.has(line) ? refusal(request) : "path not allowed";
    if (refused) {
      // Rejected URLs may contain credentials or attacker-controlled log text.
      console.log(`request -> 403 (${refused})`);
      return new Response("forbidden\n", { status: 403 });
    }
    if (activeRequests >= MAX_ACTIVE_REQUESTS) {
      return new Response("proxy busy\n", {
        status: 503,
        headers: { "Retry-After": "1" },
      });
    }
    activeRequests++;
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([
      request.signal,
      stopping.signal,
      deadline.signal,
    ]);
    let released = false;
    function release() {
      if (released) return;
      released = true;
      clearTimeout(timer);
      activeRequests--;
    }
    try {
      const response = await forward(request, target, signal, release);
      console.log(`${line} -> ${response.status}`);
      return response;
    } catch {
      release();
      console.error(`${line} -> upstream request failed`);
      return new Response("upstream error\n", { status: 502 });
    }
  },
});

// Revocation is best effort: network failures, lost mint responses, SIGKILL,
// power loss or a hard crash can leave tokens live until expiry (at most 1 h).
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => revokeAndExit());
}
process.on("uncaughtException", () => {
  console.error("Fatal uncaught exception");
  return revokeAndExit(true);
});
process.on("unhandledRejection", () => {
  console.error("Fatal unhandled rejection");
  return revokeAndExit(true);
});
console.log(`kafes push proxy: 127.0.0.1:4100 -> ${GIT}/${REPO}`);
