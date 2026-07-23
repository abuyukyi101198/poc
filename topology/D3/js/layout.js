/**
 * layout.js — Phase 1
 *
 * Computes angular and radial positions for all Option C nodes.
 *
 * Implements:
 *   §3.1  Ring model  — 5 rings for Option C: R1, R3, R4, R5, R6
 *   §5.2  Weight-proportional angular sizing (default: deduplicated_server_count)
 *   §5.2 step 5  Rack↔leaf angular alignment — data + mgmt leaves are sorted by
 *                the circular-mean angle of their served racks, interleaving the
 *                two plane-sets instead of grouping them as separate blocks.
 *   §5.3  Ring radii as fixed proportions of chart radius (420 px for Option C)
 *
 * Does NOT yet implement:
 *   - Multi-pass crossing minimisation (§5.2 step 2) — single-pass barycenter only.
 *   - Parent-group gutters beyond the rack-group gap in R6 (§5.2 step 4).
 *
 * Theming (§11.1/§11.6): all colour constants below resolve to CSS custom
 * property references (`var(--…)`) rather than literal hex values. The actual
 * hex values live in style.css, keyed under `:root`/`[data-theme="dark"]` and
 * `[data-theme="light"]` — so a single `data-theme` attribute swap on <html>
 * (see theme.js) re-colours every arc/link without any JS re-render, since
 * `var()` references resolve live against the cascade.
 *
 * Exports: CONFIG, RING_BANDS, RING_COLORS, PLANE_TINTS, BORDER_LEAF_FILL,
 *          AZ_COLOR_COUNT, getAZColor(), computeLayout()
 */

import { nodes as rawNodes, links as rawLinks } from '../data.js';

// ── Chart dimensions ──────────────────────────────────────────────────────────
export const CONFIG = {
  width:  940,
  height: 940,
  cx: 470,   // SVG centre x
  cy: 470,   // SVG centre y
};

// ── Ring radii (inner → outer).  Five rings populated for Option C. ────────────
// R0 (Region) and R2 (Tier-1 / super-spine) are absent; no dead radius bands.
// R6 (Server) receives the widest band — maximum arc-surface for per-server
// readability, as required by spec §3.1 / §5.3.
export const RING_BANDS = {
  R1: { innerRadius:  38, outerRadius:  82 },   // Pod  (innermost for Option C)
  R3: { innerRadius: 100, outerRadius: 152 },   // Spine (data + mgmt)
  R4: { innerRadius: 170, outerRadius: 234 },   // Leaf  (data + mgmt — widest switch ring)
  R5: { innerRadius: 252, outerRadius: 304 },   // Rack
  R6: { innerRadius: 322, outerRadius: 420 },   // Server (outermost, widest band)
};

// ── Angular constants ─────────────────────────────────────────────────────────
const TWO_PI      = 2 * Math.PI;
const ARC_GUTTER  = 0.007;   // rad — between sibling arcs within a ring
const GROUP_GUTTER = 0.028;  // rad — between rack-groups in the R6 server ring

// ── Per-ring arc fill colours — spec §11.1/§11.3, theme-aware (§11.6) ─────────
// Two families:
//   1. Neutral (containment-only) rings — R1 Pod, R5 Rack, R6 Server. Graduated
//      neutral scale (dark theme: darker→lighter outward; light theme: same
//      graduation, recovered/adapted from the pre-dark-theme Phase 1–4 palette).
//   2. Plane-tinted (routing) rings — R3 Spine, R4 Leaf. Data/Management nodes
//      are shaded toward their own plane hue; Border Leaves (leaf_role: "border")
//      get a third, dedicated Sage tint.
// getNodeFill(node) in render.js resolves the correct entry — RING_COLORS is
// the neutral-ring fallback, PLANE_TINTS/BORDER_LEAF_FILL are the R3/R4 cases.
// Every value here is a CSS var() reference — see style.css for the actual
// per-theme hex values.
export const RING_COLORS = {
  R1: 'var(--ring-r1)',   // Pod     — innermost visual anchor
  R5: 'var(--ring-r5)',   // Rack    — mid neutral
  R6: 'var(--ring-r6)',   // Server  — outermost (maximises arc surface)
};

export const PLANE_TINTS = {
  R3: { data: 'var(--plane-r3-data)', mgmt: 'var(--plane-r3-mgmt)' },   // Spine
  R4: { data: 'var(--plane-r4-data)', mgmt: 'var(--plane-r4-mgmt)' },   // Leaf
};

export const BORDER_LEAF_FILL = 'var(--border-leaf-fill)';   // Border Leaf (leaf_role: "border")

// ── Availability Zone accent palette — spec §7.8, theme-aware (§11.6) ─────────
// Qualitative accent set for `availability_zone`, deliberately distinct from
// the Data/Management/Border hues above so AZ colouring is never confused with
// plane identity. AZ→colour assignment is a deterministic hash so a given AZ
// id always resolves to the same colour across renders (§7.8). The palette is
// deliberately subdued/dimmed relative to the routing-link colours (§6.2)
// since AZ is a background categorization signal, not an active-routing one.
// The 4 slots are CSS vars (--az-0..--az-3); actual hex values differ per
// theme in style.css.
export const AZ_COLOR_COUNT = 4;

/**
 * getAZColor(azId) — resolves an availability_zone id to its accent colour
 * var() reference. Returns null for "n/a"/falsy so callers can fall back to
 * the node's normal fill/stroke without a null-colour rendering.
 */
export function getAZColor(azId) {
  if (!azId || azId === 'n/a') return null;
  let hash = 0;
  for (let i = 0; i < azId.length; i++) {
    hash = (hash * 31 + azId.charCodeAt(i)) >>> 0;
  }
  return `var(--az-${hash % AZ_COLOR_COUNT})`;
}

// ── Rack display order ────────────────────────────────────────────────────────
const RACK_ORDER = ['rack-1', 'rack-2', 'rack-3', 'rack-4', 'rack-5', 'rack-6'];

// ─────────────────────────────────────────────────────────────────────────────
/**
 * computeLayout(nodes?, links?)
 *
 * Returns { layoutNodes, links }
 *
 * Each layoutNode carries all original node fields plus:
 *   startAngle  {number}  radians, clockwise from 12 o'clock (D3 arc convention)
 *   endAngle    {number}  radians
 *   innerRadius {number}  px
 *   outerRadius {number}  px
 */
export function computeLayout(nodes = rawNodes, links = rawLinks) {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Outgoing-link index: source id → [target id, ...]
  const linksFrom = new Map(nodes.map(n => [n.id, []]));
  links.forEach(({ source, target }) => {
    linksFrom.get(source)?.push(target);
  });

  // Partition nodes by ring.  SAT (border-leaf satellite) is excluded.
  const byRing = { R1: [], R3: [], R4: [], R5: [], R6: [] };
  nodes.forEach(n => { if (byRing[n.ring]) byRing[n.ring].push(n); });

  // ── R5 — Racks (fixed display order, weight-proportional angles) ─────────────
  const r5Sorted     = RACK_ORDER.map(id => nodeById.get(id)).filter(Boolean);
  const r5Positioned = assignAngles(r5Sorted, ARC_GUTTER);
  const r5ById       = new Map(r5Positioned.map(n => [n.id, n]));

  // Circular-mean angular midpoint of a rack arc (needed for leaf centroid calc)
  const rackMid = id => {
    const n = r5ById.get(id);
    return n ? (n.startAngle + n.endAngle) / 2 : 0;
  };

  // ── R6 — Servers (grouped by rack, larger gutter between groups) ──────────────
  const r6Groups = RACK_ORDER.map(rackId => ({
    rackId,
    servers: byRing.R6
      .filter(n => n.metadata.rack === rackId)
      .sort((a, b) => a.id.localeCompare(b.id)),
  }));
  const r6Positioned = assignAnglesGrouped(r6Groups, ARC_GUTTER, GROUP_GUTTER);

  // ── R4 — Leaves (sorted by circular-mean rack centroid — §5.2 step 5) ─────────
  //
  // Using the circular mean (atan2 of weighted unit-vector sum) rather than an
  // arithmetic mean prevents the angular wrap-around artefact that would occur
  // when a leaf spans racks near 0 and 2π (e.g. leaf-data-2 serves rack-6 at
  // ~5.8 rad as well as rack-1 at ~0.5 rad; arithmetic mean incorrectly places
  // it near the centre of the circle).
  const r4WithCentroid = byRing.R4.map(leaf => {
    const servedRacks = linksFrom.get(leaf.id)
      .filter(id => nodeById.get(id)?.ring === 'R5');

    let sumSin = 0, sumCos = 0;
    servedRacks.forEach(rId => {
      const w   = nodeById.get(rId)?.weight ?? 0;
      const mid = rackMid(rId);
      sumSin += Math.sin(mid) * w;
      sumCos += Math.cos(mid) * w;
    });
    let centroid = Math.atan2(sumSin, sumCos);
    if (centroid < 0) centroid += TWO_PI;

    return { ...leaf, _centroid: centroid };
  });

  // Primary sort: rack centroid angle.
  // Tie-break: data before mgmt — keeps each data/mgmt pair adjacent where
  // they serve the same rack(s), giving the interleaved layout required by §5.2.
  r4WithCentroid.sort(
    (a, b) => a._centroid - b._centroid || (a.plane === 'data' ? -1 : 1)
  );
  const r4Positioned = assignAngles(r4WithCentroid, ARC_GUTTER);
  const r4ById       = new Map(r4Positioned.map(n => [n.id, n]));

  const leafMid = id => {
    const n = r4ById.get(id);
    return n ? (n.startAngle + n.endAngle) / 2 : 0;
  };

  // ── R3 — Spines (sorted by circular-mean leaf centroid, barycenter heuristic) ──
  const r3WithCentroid = byRing.R3.map(spine => {
    const servedLeaves = linksFrom.get(spine.id)
      .filter(id => nodeById.get(id)?.ring === 'R4');

    let sumSin = 0, sumCos = 0;
    servedLeaves.forEach(lId => {
      const w   = nodeById.get(lId)?.weight ?? 0;
      const mid = leafMid(lId);
      sumSin += Math.sin(mid) * w;
      sumCos += Math.cos(mid) * w;
    });
    let centroid = Math.atan2(sumSin, sumCos);
    if (centroid < 0) centroid += TWO_PI;

    return { ...spine, _centroid: centroid };
  });

  r3WithCentroid.sort(
    (a, b) => a._centroid - b._centroid || (a.plane === 'data' ? -1 : 1)
  );
  const r3Positioned = assignAngles(r3WithCentroid, ARC_GUTTER);

  // ── R1 — Pod (single arc spanning the full circle) ────────────────────────────
  const r1Positioned = byRing.R1.map(n => ({
    ...n, startAngle: 0, endAngle: TWO_PI,
  }));

  // ── Attach ring geometry and return ──────────────────────────────────────────
  const layoutNodes = [
    ...r1Positioned .map(n => ({ ...n, ...RING_BANDS.R1 })),
    ...r3Positioned .map(n => ({ ...n, ...RING_BANDS.R3 })),
    ...r4Positioned .map(n => ({ ...n, ...RING_BANDS.R4 })),
    ...r5Positioned .map(n => ({ ...n, ...RING_BANDS.R5 })),
    ...r6Positioned .map(n => ({ ...n, ...RING_BANDS.R6 })),
  ];

  return { layoutNodes, links };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * assignAngles — flat sorted list of nodes, uniform arc gutter between each.
 * Angles start at 0 (12 o'clock), increase clockwise.
 * The wrap-around gap (last arc end → first arc start going around) equals
 * exactly one gutter width, keeping the spacing consistent at the seam.
 *
 * §5.2 step 3 note — minimum arc width:
 *   The spec requires a fixed minimum arc width so low-weight nodes stay
 *   clickable/hoverable (§9.2 `min_arc_width_px: implementation-defined`).
 *   This is NOT enforced here.  For the Option C fixture no arc falls below a
 *   practical minimum — the narrowest arcs are individual server arcs at
 *   weight 1/35 ≈ 0.170 rad, giving ~63 px arc-length at R6 mid-radius.
 *   When this function is generalised to larger deployments (Options B/D) or
 *   to bandwidth-weighted modes, add a two-pass clamp:
 *     1. Give clamped nodes the minimum span.
 *     2. Redistribute remaining available angle proportionally among the rest.
 */
function assignAngles(sortedNodes, gutter) {
  const totalWeight = sortedNodes.reduce((s, n) => s + n.weight, 0);
  const totalGutter = sortedNodes.length * gutter;
  const available   = TWO_PI - totalGutter;

  let angle = 0;
  return sortedNodes.map(n => {
    const span = (n.weight / totalWeight) * available;
    const out  = { ...n, startAngle: angle, endAngle: angle + span };
    angle += span + gutter;
    return out;
  });
}

/**
 * assignAnglesGrouped — R6 server ring.
 * Arcs within each group (rack) share the small inner gutter; a larger group
 * gutter separates consecutive rack groups, visually pre-grouping servers by
 * rack before any links are drawn (§5.2 step 4).
 *
 * The wrap-around seam (last rack → first rack going around the circle) is
 * also treated as a between-group gap — betweenGutters = groups.length, not
 * groups.length − 1.  Starting at groupGutter/2 centres the seam gap so that
 * both sides of the break are equally spaced, matching every other group gap.
 */
function assignAnglesGrouped(groups, innerGutter, groupGutter) {
  const allNodes     = groups.flatMap(g => g.servers);
  const totalWeight  = allNodes.reduce((s, n) => s + n.weight, 0);

  // Count gutter instances — include the wrap-around gap as a between-group gap.
  const withinGutters  = groups.reduce(
    (s, g) => s + Math.max(0, g.servers.length - 1), 0
  );
  const betweenGutters = groups.length;   // includes the wrap-around seam
  const totalGutter    = withinGutters * innerGutter + betweenGutters * groupGutter;
  const available      = TWO_PI - totalGutter;

  // Half a group-gutter offset so the seam is centred between rack-6 and rack-1.
  let angle = groupGutter / 2;
  const result = [];
  groups.forEach((group, gi) => {
    if (gi > 0) angle += groupGutter;
    group.servers.forEach((n, i) => {
      if (i > 0) angle += innerGutter;
      const span = (n.weight / totalWeight) * available;
      result.push({ ...n, startAngle: angle, endAngle: angle + span });
      angle += span;
    });
  });
  return result;
}


