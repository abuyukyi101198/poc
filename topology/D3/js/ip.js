/**
 * ip.js — minimal IPv4 CIDR utility for Stack View (spec §12.2)
 *
 * Converts a CIDR string (e.g. "10.0.0.0/16") into its numeric [start, end]
 * address range (inclusive), so Stack View can position and size each pod's
 * column by real address value rather than an arbitrary ordinal index —
 * gaps/overlaps in real IP planning become visible whitespace/overlap.
 */

function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * parseCidr("10.0.0.0/16") → { start: <uint32>, end: <uint32> } (inclusive).
 */
export function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  const base = ipToInt(ip);
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const start = (base & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end };
}

