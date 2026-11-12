# kafes: instructions

How to set up and use [`kafes`](kafes), the script that runs OMP coding agents
in a cage. The design and the reason for each rule are in
[`README.md`](README.md).

> [!NOTE]
> Verified on a laptop up to a started agent: setup, the manual pushes, task
> workshop launch and its checks, and OMP starting inside the workshop. Pushing
> through the proxy and the check on a real agent PR haven't run yet. See the
> spec's [Open items](README.md#open-items).

## Before you start

- **Ubuntu host** with a desktop session (kafes runs its services as systemd
  user units), `sudo`, `git`, `curl`, `openssl` and `jq`
  (`sudo apt install jq`). kafes installs LXD, Workshop, Bun and OMP itself,
  after asking.
- **Your fork** of the project, public, and a local checkout of it whose
  `origin` is that fork.
- **A browser signed in to GitHub** as you. kafes never asks for GitHub
  credentials and never pushes; every step that writes to GitHub is printed for
  you to do.

Every manual step ends with `Done? [Y/n]`. Answering `n` stops kafes; re-run the
same command to continue. Re-runs are safe: finished steps are checked and
skipped, and kafes never redoes or overwrites them.

## One-time setup

From your checkout:

```bash
./kafes setup
```

Setup walks through these steps. The ones marked _manual_ are yours; kafes
prints the URLs and values and then checks the result.

1. **Host tools.** Installs anything missing. If the Workshop SDK store is
   unreachable, kafes retries and then asks whether to continue; `task new`
   needs it later.
2. **Provider logins.** Logs the host's OMP broker in to GitHub Copilot and
   OpenRouter. Don't approve Copilot's repository write access; for
   OpenRouter, use a dedicated key with a credit limit.
3. **GitHub accounts** _(manual)_. kafes asks for your username, repository and
   checkout, then guides you through:
   - a **kafes organization** you own (default `<user>-kafes`), with no other
     members;
   - a **fork of your fork** into it, with Actions disabled;
   - a **GitHub App** owned by it: Contents read and write, nothing else, no
     webhook. Generate a private key; kafes moves the download to
     `~/.config/kafes/push/app.pem` and deletes the original;
   - the App's **installation** on that fork only. kafes reads the bot identity
     the agent will commit as.
4. **Trusted files and push proxy.** Copies the script, the proxy and the check
   workflow to `~/kafes/sandbox`, and links `~/.local/bin/kafes` to it.
   Read `~/kafes/sandbox/kafes-push-proxy.ts` when asked.
5. **Network ACL.** Attaches `kafes-no-lan` to the LXD bridge the workshops use
   (`lxdbr0` unless you changed it), and records the bridge's previous ACLs for
   teardown.
6. **Edit-rule check** _(manual)_. Read `~/kafes/sandbox/kafes-pr-check.yml`
   when asked: it runs with a token that can write to your fork. Then:
   - push the `kafes-checks` branch kafes prepared, with the command it prints;
   - make `kafes-checks` your fork's default branch;
   - create the repository **variables** `KAFES_FORK` and `KAFES_EMAIL`, with
     the printed values, and enable Actions on your fork;
   - push the throwaway `kafes-base/setup` branch, open the dummy PR kafes
     describes, wait for a `kafes-pr-check` status (failing is fine), then
     close it without merging;
   - create the `kafes-base` ruleset exactly as printed: active, empty bypass
     list, `kafes-base/**`, restrict deletions, block force pushes, require
     `kafes-pr-check` from **GitHub Actions** (never _Any source_), and tick
     _Do not require status checks on creation_.
7. **Verify.** Starts the services and reads the kafes fork through the proxy.

From here on, run `kafes` from your home directory. If `kafes` isn't found,
`~/.local/bin` isn't on your `PATH` yet: log in again, or use
`~/kafes/sandbox/kafes`.

> [!IMPORTANT]
> After changing `kafes`, `kafes-push-proxy.ts` or `kafes-pr-check.yml` in the
> repository, re-run `./kafes setup` from the checkout so `~/kafes/sandbox` gets
> the new copies.

## Per task

```bash
kafes task new <task> <feature-branch>
```

`<task>` is a short name such as `zones-table-sort`; the feature branch must be
on your fork. kafes:

1. Asks for `sudo` once, to read the bridge's ACL and subnet. If the prompt
   seems to hang, your `sudo` may be waiting for a security key or approval.
2. Asks you to push `kafes-base/<task>`, at the feature branch's head, with the
   command it prints (or offers to reuse an existing one).
3. Starts the broker, gateway and push proxy, and copies your allowlisted host
   OMP settings (model roles, fallbacks, display). It warns about any model
   provider the gateway can't serve.
4. Launches the workshop, disconnects the package caches, connects the two
   tunnels, and checks that nothing else is connected and that the workshop is
   on the ACL bridge.
5. Installs the tools, clones your fork at `kafes-base/<task>` onto a
   `kafes/<task>` branch, and runs `yarn install`.

It then offers to open the workshop terminal. It doesn't start OMP.

| Command                   | What it does                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `kafes task shell <task>` | Restores the agent's launcher, policy, prompt and model settings from the host, then opens the workshop terminal         |
| `kafes task stop <task>`  | Revokes the task's credentials, stops the services and the workshop. Files, OMP sessions and installed packages are kept |
| `kafes task start <task>` | Restores the trusted workshop definition, starts the workshop, re-checks its connections and issues new credentials      |
| `kafes task end <task>`   | Revokes the credentials, stops the services, removes the workshop and prints the review links                            |

In the workshop terminal, run `kafes-omp` to start the agent, or `kafes-omp -c`
to continue its last session. `/exit` returns you to the workshop terminal and
`exit` to the host. The workshop keeps running until you stop or end the task.

> [!WARNING]
> Start the agent only with `kafes-omp`. Plain `omp` runs with OMP's defaults,
> which approve every tool call. To restart the agent, `exit` the terminal and
> run `kafes task shell <task>` again, so its launcher and policy are restored
> first.

> [!CAUTION]
> Never run `workshop refresh` or `workshop restore` on a task workshop, and
> never `cd` into `~/kafes/tasks` or open it in an IDE: the agent can write
> there. kafes refuses to run from inside it.

Only one task is active at a time. If `task new` or `task start` stops part-way
or you press Ctrl+C, kafes prints the command that cleans up.

## Review and merge

`kafes task end` prints, when the agent has pushed `kafes/<task>`:

- a link that opens the PR from the kafes fork into `kafes-base/<task>`;
- the branch's head commit.

In the browser:

1. Open the PR as yourself.
2. Wait for `kafes-pr-check` to pass on the current head.
3. Review the diff. Read every file under "Review closely" line by line, and
   treat test files as code that will run.
4. Merge only if the PR's head is still the commit kafes printed.

> [!CAUTION]
> Never fetch, clone or check out the agent's branch on the host before it is
> merged.

Then merge `kafes-base/<task>` into your feature branch on GitHub (kafes prints
that link too), pull it into your checkout, and test as usual. Agent PRs can't
change dependency files; test files and test setup do run.

## Teardown

```bash
kafes teardown
```

Removes the whole setup, not one task. kafes ends any active task, removes task
workshops, restores the bridge's ACLs, deletes its local files and the
`~/.local/bin/kafes` link, and offers to log the broker out and uninstall OMP.
It prints the GitHub steps that stay manual:

- delete the GitHub App **before** the kafes organization that owns it;
- revoke the OpenRouter key and the Copilot authorization used for the logins;
- restore your fork's default branch (kafes remembers the old one), delete the
  ruleset and the `KAFES_*` variables, and delete the kafes branches with the
  command it prints;
- delete the kafes fork, and last, the organization.

Workshop and LXD stay installed; remove them only if nothing else uses them.
