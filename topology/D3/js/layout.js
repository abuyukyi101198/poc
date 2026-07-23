/**
 * layout.js — Phase 1 (generalized for multi-option support, Phase 9)
 *
 * Computes angular and radial positions for whichever option's nodes/links
 * are passed in — Option A/B (3 rings: TOR/Rack/Server), Option C (5 rings:
 * Pod/Spine/Leaf/Rack/Server), Option D (6 rings: Pod/Superspine/Spine/Leaf/
 * Rack/Server) all flow through the same generic algorithm below,
 * driven entirely by which of the 7 canonical rings (R0-R6) are actually
 * present in the node set (spec §3.2 "ring independence" / §3.3 per-option
 * ring population).
 *
 * Implements:
 *   §3.1  Ring model — generic, any subset of R0-R6 (see RING_ORDER)
 *   §3.2  Ring independence — omitted rings consume no radial space;
 *         adjacent populated rings stay contiguous (computeRingBands())
 *   §5.2  Weight-proportional angular sizing (default: deduplicated_server_count)
 *   §5.2 step 5  Rack↔leaf-style angular alignment — generalized: every ring
 *                between the server-adjacent ring and the root is sorted by
 *                the circular-mean centroid of its children in the
 *                next-outward populated ring, not just R3/R4 specifically.
 *   §5.3  Ring radii as fixed proportions of the available chart radius
 *
 * Does NOT yet implement:
 *   - Multi-pass crossing minimisation (§5.2 step 2) — single-pass barycenter only.
 *   - Parent-group gutters beyond the base-ring group gap in the outermost
 *     (server) ring (§5.2 step 4).
 *
 * Theming (§11.1/§11.6): all colour constants below resolve to CSS custom
 * property references (`var(--…)`) rather than literal hex values. The actual
 * hex values live in style.css, keyed under `:root`/`[data-theme="dark"]` and
 * `[data-theme="light"]` — so a single `data-theme` attribute swap on <html>
 * (see theme.js) re-colours every arc/link without any JS re-render, since
 * `var()` references resolve live against the cascade.
 *
 * Exports: CONFIG, RING_ORDER, RING_COLORS, PLANE_TINTS, BORDER_LEAF_FILL,
 *          AZ_COLOR_COUNT, getAZColor(), computeRingBands(), computeLayout()
 */

import { nodes as rawNodes, links as rawLinks } from '../data/option-c.js';

// ── Chart dimensions ──────────────────────────────────────────────────────────
export const CONFIG = {
  width:  940,
  height: 940,
  cx: 470,   // SVG centre x
  cy: 470,   // SVG centre y
};

// ── Canonical ring order (innermost → outermost), spec §3.1 ──────────────────
export const RING_ORDER = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];

// ── Radial layout constants ───────────────────────────────────────────────────
const INNER_START_RADIUS = 38;    // px — innermost populated ring always starts here
const MAX_OUTER_RADIUS   = 420;   // px — outermost populated ring always ends here
const RING_GAP_PX        = 18;    // px — fixed gap between adjacent populated rings

// Relative band-thickness weight per ring, independent of how many rings are
// actually populated in a given option — e.g. R6 (Server) is always the
// widest band whenever it's present, whether it's sitting next to R5 (Rack)
// in Option C/D or directly next to R4 (TOR) in Option A/B. Ratios are
// carried over from the original Option C hardcoded band widths
// (R1=44, R3=52, R4=64, R5=52, R6=98 px), normalized to R1=1.0; R0/R2 (not
// present in Option C) are estimated in between neighboring rings.
const RING_BAND_WEIGHT = { R0: 0.8, R1: 1.0, R2: 1.3, R3: 1.18, R4: 1.45, R5: 1.18, R6: 2.23 };

/**
 * computeRingBands(populatedRings) — spec §3.2/§5.3.
 * Given the list of populated rings (in canonical inner→outer order),
 * distributes the available radial space between INNER_START_RADIUS and
 * MAX_OUTER_RADIUS proportionally by RING_BAND_WEIGHT, with a fixed gap
 * between each. Omitted rings simply never appear in `populatedRings`, so
 * they consume no space and adjacent populated rings stay contiguous.
 */
export function computeRingBands(populatedRings) {
  const gapTotal   = RING_GAP_PX * Math.max(0, populatedRings.length - 1);
  const available  = MAX_OUTER_RADIUS - INNER_START_RADIUS - gapTotal;
  const totalWeight = populatedRings.reduce((s, r) => s + (RING_BAND_WEIGHT[r] ?? 1), 0);

  const bands = {};
  let cursor = INNER_START_RADIUS;
  populatedRings.forEach(r => {
    const thickness = totalWeight > 0 ? (RING_BAND_WEIGHT[r] ?? 1) / totalWeight * available : 0;
    bands[r] = { innerRadius: cursor, outerRadius: cursor + thickness };
    cursor += thickness + RING_GAP_PX;
  });
  return bands;
}

// ── Angular constants ─────────────────────────────────────────────────────────
const TWO_PI       = 2 * Math.PI;
const ARC_GUTTER   = 0.007;   // rad — between sibling arcs within a ring
const GROUP_GUTTER = 0.028;   // rad — between parent-groups in the outermost (server) ring

// ── Per-ring arc fill colours — spec §11.1/§11.3, theme-aware (§11.6) ─────────
// Two families:
//   1. Neutral (containment-only) rings — R0, R1, R5, R6. Graduated neutral
//      scale (dark theme: darker→lighter outward; light theme: same
//      graduation, adapted from the pre-dark-theme Phase 1–4 palette).
//   2. Plane-tinted (routing) rings — R2 Super-spine, R3 Spine, R4 Leaf.
//      Data/Management nodes are shaded toward their own plane hue; Border
//      Leaves (leaf_role: "border") get a third, dedicated Sage tint.
// getNodeFill(node) in render.js resolves the correct entry — RING_COLORS is
// the neutral-ring fallback, PLANE_TINTS/BORDER_LEAF_FILL are the routing-ring
// cases. Every value here is a CSS var() reference — see style.css.
export const RING_COLORS = {
  R0: 'var(--ring-r0)',   // Region  — innermost-most visual anchor (Option D full spec, unused in current fixtures)
  R1: 'var(--ring-r1)',   // Pod / Border Leaf root — innermost visual anchor
  R5: 'var(--ring-r5)',   // Rack    — mid neutral
  R6: 'var(--ring-r6)',   // Server  — outermost (maximises arc surface)
};

export const PLANE_TINTS = {
  R2: { data: 'var(--plane-r2-data)', mgmt: 'var(--plane-r2-mgmt)' },   // Super-spine
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

// ─────────────────────────────────────────────────────────────────────────────
/**
 * computeLayout(nodes?, links?)
 *
 * Returns { layoutNodes, links, bands, populatedRings }
 *
 * Each layoutNode carries all original node fields plus:
 *   startAngle  {number}  radians, clockwise from 12 o'clock (D3 arc convention)
 *   endAngle    {number}  radians
 *   innerRadius {number}  px
 *   outerRadius {number}  px
 *
 * Algorithm (generic across every option, spec §5.2):
 *   1. Group nodes by ring; determine which of the 7 canonical rings are
 *      actually populated, in inner→outer order (§3.2/§3.3).
 *   2. Compute radial bands for exactly the populated rings (computeRingBands()).
 *   3. "Base ring" = the populated ring immediately inside the outermost ring
 *      (normally R6/Server) — e.g. R5 Rack in Options C/D, or R4/TOR itself
 *      in Options A/B where there is no Rack ring. The base ring is
 *      positioned FIRST, in the fixture's own node order, weight-proportional
 *      (or full-circle if it's the fixture's only node in that ring).
 *   4. The outermost ring is grouped by each node's primary parent in the
 *      base ring (the first-listed link from a base-ring node to it, so
 *      dual-homed nodes still get a single clustering anchor) and positioned
 *      via assignAnglesGrouped().
 *   5. Every remaining populated ring between the base ring and the root is
 *      processed inward, one at a time, sorted by the circular-mean centroid
 *      of its children in the ring just positioned — reproducing the
 *      original R4→R3→R1 barycenter chain, generalized to any ring letters/
 *      depth (§5.2 step 5).
 *   6. Any ring with exactly one node spans the full circle (the Option C
 *      Pod / Option D Border-Leaf-pair-of-one-if-ever case); multi-node
 *      rings use the weight-proportional + centroid-sort path.
 */
export function computeLayout(nodes = rawNodes, links = rawLinks) {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Outgoing-link index: source id → [target id, ...]
  const linksFrom = new Map(nodes.map(n => [n.id, []]));
  links.forEach(({ source, target }) => {
    linksFrom.get(source)?.push(target);
  });

  // Partition nodes by ring, preserving each ring's original fixture order.
  const byRing = {};
  RING_ORDER.forEach(r => { byRing[r] = []; });
  nodes.forEach(n => { if (byRing[n.ring]) byRing[n.ring].push(n); });

  const populatedRings = RING_ORDER.filter(r => byRing[r].length > 0);
  const bands = computeRingBands(populatedRings);

  if (populatedRings.length === 0) {
    return { layoutNodes: [], links, bands, populatedRings };
  }

  const positioned = {};
  const outerRing = populatedRings[populatedRings.length - 1];
  const outerIdx  = populatedRings.length - 1;

  if (outerRing === 'R6' && outerIdx > 0) {
    // ── Base ring (the populated ring just inside Server) ─────────────────────
    const baseRing = populatedRings[outerIdx - 1];
    positioned[baseRing] = positionFixedOrGroup(byRing[baseRing]);

    // ── Server ring, grouped by each server's primary base-ring parent ────────
    const baseById = new Map(positioned[baseRing].map(n => [n.id, n]));
    const primaryParent = new Map();
    links.forEach(({ source, target }) => {
      if (primaryParent.has(target)) return;
      const t = nodeById.get(target);
      const s = nodeById.get(source);
      if (t?.ring === 'R6' && s?.ring === baseRing) primaryParent.set(target, source);
    });

    const groups = positioned[baseRing].map(baseNode => ({
      rackId: baseNode.id,
      servers: byRing.R6
        .filter(n => primaryParent.get(n.id) === baseNode.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }));
    // Any server with no resolvable base-ring parent (shouldn't happen with a
    // well-formed fixture) still needs a bucket so it isn't silently dropped.
    const ungrouped = byRing.R6.filter(n => !primaryParent.has(n.id));
    if (ungrouped.length > 0) groups.push({ rackId: '__ungrouped__', servers: ungrouped });

    positioned.R6 = assignAnglesGrouped(groups, ARC_GUTTER, GROUP_GUTTER);

    // ── Remaining rings, inward from baseRing to the root, centroid-sorted ────
    const baseRingIdx = populatedRings.indexOf(baseRing);
    let childRing = baseRing;
    for (let i = baseRingIdx - 1; i >= 0; i--) {
      const ring = populatedRings[i];
      positioned[ring] = positionByCentroid(byRing[ring], positioned[childRing], nodeById, linksFrom, childRing);
      childRing = ring;
    }
  } else {
    // Fallback (no Server ring, or Server is the only populated ring) —
    // position every ring flat/independently. Not used by the current
    // fixtures, but keeps the function well-defined for edge cases.
    populatedRings.forEach(ring => {
      positioned[ring] = positionFixedOrGroup(byRing[ring]);
    });
  }

  const layoutNodes = populatedRings.flatMap(ring =>
    (positioned[ring] ?? []).map(n => ({ ...n, ...bands[ring] }))
  );

  return { layoutNodes, links, bands, populatedRings };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * positionFixedOrGroup(ringNodes) — positions a ring in its fixture-declared
 * order (weight-proportional angles), or as a single full-circle arc if the
 * ring has exactly one node (the Pod/Border-Leaf-root convention).
 */
function positionFixedOrGroup(ringNodes) {
  if (ringNodes.length === 1) {
    return ringNodes.map(n => ({ ...n, startAngle: 0, endAngle: TWO_PI }));
  }
  return assignAngles(ringNodes, ARC_GUTTER);
}

/**
 * positionByCentroid(ringNodes, childPositioned, nodeById, linksFrom, childRingName)
 *
 * Generic version of the original R4/R3 barycenter placement: sorts
 * `ringNodes` by the circular-mean angle of each node's children in the
 * already-positioned `childRingName` ring (weighted by child weight), tie-
 * breaking data-before-mgmt so paired data/mgmt nodes serving the same
 * children stay adjacent (§5.2 step 5). A single-node ring still spans the
 * full circle (root convention), matching positionFixedOrGroup().
 */
function positionByCentroid(ringNodes, childPositioned, nodeById, linksFrom, childRingName) {
  if (ringNodes.length === 1) {
    return ringNodes.map(n => ({ ...n, startAngle: 0, endAngle: TWO_PI }));
  }

  const childById = new Map(childPositioned.map(n => [n.id, n]));
  const childMid = id => {
    const c = childById.get(id);
    return c ? (c.startAngle + c.endAngle) / 2 : 0;
  };

  const withCentroid = ringNodes.map(n => {
    const children = (linksFrom.get(n.id) ?? []).filter(id => nodeById.get(id)?.ring === childRingName);
    let sumSin = 0, sumCos = 0;
    children.forEach(cid => {
      const w   = nodeById.get(cid)?.weight ?? 0;
      const mid = childMid(cid);
      sumSin += Math.sin(mid) * w;
      sumCos += Math.cos(mid) * w;
    });
    let centroid = Math.atan2(sumSin, sumCos);
    if (centroid < 0) centroid += TWO_PI;
    return { ...n, _centroid: centroid };
  });

  withCentroid.sort((a, b) => a._centroid - b._centroid || (a.plane === 'data' ? -1 : 1));
  return assignAngles(withCentroid, ARC_GUTTER);
}

/**
 * assignAngles — flat sorted list of nodes, uniform arc gutter between each.
 * Angles start at 0 (12 o'clock), increase clockwise.
 * The wrap-around gap (last arc end → first arc start going around) equals
 * exactly one gutter width, keeping the spacing consistent at the seam.
 *
 * §5.2 step 3 note — minimum arc width:
 *   The spec requires a fixed minimum arc width so low-weight nodes stay
 *   clickable/hoverable (§9.2 `min_arc_width_px: implementation-defined`).
 *   This is NOT enforced here. When this function is extended to bandwidth-
 *   weighted modes, add a two-pass clamp:
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
 * assignAnglesGrouped — outermost (server) ring.
 * Arcs within each group (base-ring parent) share the small inner gutter; a
 * larger group gutter separates consecutive groups, visually pre-grouping
 * servers by their parent before any links are drawn (§5.2 step 4).
 *
 * The wrap-around seam (last group → first group going around the circle) is
 * also treated as a between-group gap — betweenGutters = groups.length, not
 * groups.length − 1. Starting at groupGutter/2 centres the seam gap so that
 * both sides of the break are equally spaced, matching every other group gap.
 */
function assignAnglesGrouped(groups, innerGutter, groupGutter) {
  const nonEmptyGroups = groups.filter(g => g.servers.length > 0);
  const allNodes    = nonEmptyGroups.flatMap(g => g.servers);
  const totalWeight = allNodes.reduce((s, n) => s + n.weight, 0);

  const withinGutters  = nonEmptyGroups.reduce(
    (s, g) => s + Math.max(0, g.servers.length - 1), 0
  );
  const betweenGutters = nonEmptyGroups.length;   // includes the wrap-around seam
  const totalGutter    = withinGutters * innerGutter + betweenGutters * groupGutter;
  const available      = TWO_PI - totalGutter;

  let angle = groupGutter / 2;
  const result = [];
  nonEmptyGroups.forEach((group, gi) => {
    if (gi > 0) angle += groupGutter;
    group.servers.forEach((n, i) => {
      if (i > 0) angle += innerGutter;
      const span = totalWeight > 0 ? (n.weight / totalWeight) * available : 0;
      result.push({ ...n, startAngle: angle, endAngle: angle + span });
      angle += span;
    });
  });
  return result;
}


