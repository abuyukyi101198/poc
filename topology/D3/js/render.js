/**
 * render.js — Phase 1 + 2 + 5
 *
 * Phase 1: static ring geometry — arc segments, guide circles, labels.
 * Phase 2: plain radial links, plane-colour-coded.
 * Phase 5: Canonical/Ubuntu brand colours — dark-theme surface (spec §11.1),
 *          plane-tinted node fills (§11.3), parallel lane-offset "cable"
 *          link rendering (§6.6), and Border Leaf/peer-adjacency support.
 * Phase 7: Availability Zone rack-fill / server-override styling (§7.8).
 *          MAAS control-plane data (§7.7) is surfaced via the tooltip only
 *          (tooltip.js) — no arc-level badge is rendered.
 *
 * Theming (§11.6): every colour value below is a CSS var() reference, not a
 * literal hex — see style.css for the dark/light hex values and theme.js for
 * the toggle that flips `document.documentElement.dataset.theme`.
 *
 * Phase 4 hover/focus and plane toggles are in interaction.js.
 * Tooltip panel content (§8.6) is in tooltip.js.
 */

import * as d3 from 'd3';
import { computeLayout, CONFIG, RING_ORDER, RING_COLORS, PLANE_TINTS, BORDER_LEAF_FILL, getAZColor } from './layout.js';

// Minimum arc span (degrees) at which an inline label is shown.
// Arcs narrower than this degrade to tooltip-only (§8.4).
const MIN_LABEL_DEG = {
  R1: 0,    // Pod / Border Leaf root: always labelled (single full-circle arc)
  R2: 3,    // Superspine
  R3: 3,    // Spines: large arcs, always visible
  R4: 3,    // Leaves
  R5: 4,    // Racks
  R6: 6,    // Servers: small arcs — only label if there is room
};

// Default human-readable ring names (can be overridden per-option via meta.ringNames)
const DEFAULT_RING_NAMES = {
  R0: 'Region',
  R1: 'Pod',
  R2: 'Superspine',
  R3: 'Spine',
  R4: 'Leaf',
  R5: 'Rack',
  R6: 'Server',
};

// ── Phase 5 link colours — Canonical/Ubuntu brand palette, theme-aware (§6.2/§11.6) ──
//
// Every value here is a CSS var() reference, not a literal hex — the actual
// per-theme hex values live in style.css under `[data-theme="dark"]` /
// `[data-theme="light"]`, so toggling the theme (theme.js) re-colours every
// link without any JS re-render. Colour is resolved by `plane` for routing/
// containment links, and by `type` for the `peer_adjacency` exception
// (§6.1a) — see linkColorKey() below.
export const LINK_COLORS = {
  data:           'var(--link-data)',
  mgmt:           'var(--link-mgmt)',
  shared:         'var(--link-shared)',
  peer_adjacency: 'var(--link-peer)',
};

export const LINK_HOVER_COLORS = {
  data:           'var(--link-data-hover)',
  mgmt:           'var(--link-mgmt-hover)',
  shared:         'var(--link-shared-hover)',
  peer_adjacency: 'var(--link-peer-hover)',
};

// All planes at full opacity — the tint colour carries the visual weight,
// not a CSS opacity fade (action plan §6.1 "rather than arbitrary opacity").
export const LINK_OPACITY = {
  data:   1,
  mgmt:   1,
  shared: 1,
  peer_adjacency: 1,
};

/**
 * linkColorKey(d) — colour lookup key for a link datum.
 * `peer_adjacency` links are keyed by `type`, not `plane` (spec §6.2), since
 * they carry `plane: "shared"` for schema consistency but must render in a
 * distinct hue from plain containment links.
 */
export function linkColorKey(d) {
  return d.type === 'peer_adjacency' ? 'peer_adjacency' : (d.plane ?? 'shared');
}

/**
 * getNodeFill(node) — resolves arc fill colour per spec §11.3/§7.8.
 *   - R5 Rack nodes with a populated `availability_zone` (§7.8) get the AZ's
 *     accent colour, overriding the flat neutral rack fill — this takes
 *     priority since AZ is a whole-rack tenancy signal, not a plane one.
 *   - R4 Border Leaves (`leaf_role: "border"`) get the dedicated Sage fill,
 *     regardless of `plane`.
 *   - R2/R3/R4 routing nodes get their plane-tinted fill (Data/Mgmt).
 *   - All other rings (R0, R1, R5, R6 — containment-only, and R5 with no AZ) get
 *     the flat neutral RING_COLORS fill.
 */
export function getNodeFill(node) {
  if (node.ring === 'R5') {
    const azColor = getAZColor(node.availability_zone);
    if (azColor) return azColor;
  }
  if (node.ring === 'R4' && node.leaf_role === 'border') return BORDER_LEAF_FILL;
  const tint = PLANE_TINTS[node.ring]?.[node.plane];
  if (tint) return tint;
  return RING_COLORS[node.ring] ?? 'var(--ring-r5)';
}

/**
 * getArcOverrideStroke(node, rackAzById) — §7.8 R6 AZ-override rendering.
 * Returns the overriding AZ's accent colour when an R6 server's own
 * `availability_zone` differs from its parent rack's, else null (caller
 * falls back to the default arc-separator stroke).
 */
export function getArcOverrideStroke(node, rackAzById) {
  if (node.ring !== 'R6') return null;
  if (!node.availability_zone || node.availability_zone === 'n/a') return null;
  const rackAz = rackAzById.get(node.metadata?.rack);
  if (!rackAz || rackAz === node.availability_zone) return null;
  return getAZColor(node.availability_zone);
}

const TWO_PI = 2 * Math.PI;

/**
 * init(rootSelector, nodes, links, meta)
 * Renders ring geometry into the SVG element matched by rootSelector.
 * Creates a `links` placeholder group in the correct DOM stacking order
 * so Phase 2's drawLinks() can populate it without re-ordering elements.
 * Accepts optional nodes/links/meta so any option fixture can be rendered.
 * Returns { svg, root, layoutNodes, links }.
 */
export function init(rootSelector = '#topology', rawNodes = null, rawLinks = null, meta = {}) {
  const { layoutNodes, links, bands, populatedRings } =
    rawNodes ? computeLayout(rawNodes, rawLinks) : computeLayout();

  // Per-option ring name overrides (e.g. R4→"TOR" for Options A/B).
  const RING_NAMES = { ...DEFAULT_RING_NAMES, ...(meta.ringNames ?? {}) };

  // Rack id → availability_zone, for the R6 AZ-override stroke check (§7.8).
  const rackAzById = new Map(
    layoutNodes.filter(n => n.ring === 'R5').map(n => [n.id, n.availability_zone])
  );

  // ── SVG root ──────────────────────────────────────────────────────────────────
  const svg = d3.select(rootSelector)
    .attr('width',   CONFIG.width)
    .attr('height',  CONFIG.height)
    .attr('viewBox', `0 0 ${CONFIG.width} ${CONFIG.height}`);

  // Centred group — all coordinates relative to (cx, cy)
  const root = svg.append('g')
    .attr('class', 'topology-root')
    .attr('transform', `translate(${CONFIG.cx},${CONFIG.cy})`);

  // ── Ring-band guide circles ───────────────────────────────────────────────────
  root.append('g')
    .attr('class', 'ring-guides')
    .selectAll('circle')
    .data(Object.values(bands))
    .join('circle')
      .attr('r',            d => d.outerRadius + 2)
      .attr('fill',         'none')
      .attr('stroke',       'var(--ring-guide-stroke)')
      .attr('stroke-width', 0.6);

  // ── Arc generator ─────────────────────────────────────────────────────────────
  const arcGen = d3.arc()
    .innerRadius(d => d.innerRadius)
    .outerRadius(d => d.outerRadius)
    .startAngle( d => d.startAngle)
    .endAngle(   d => d.endAngle)
    .padAngle(0)
    .cornerRadius(2);

  // ── Node arcs ─────────────────────────────────────────────────────────────────
  // Native <title> tooltip removed (spec §8.6) — replaced by the styled HTML
  // tooltip panel wired up in tooltip.js, using the same layoutNodes/root.
  root.append('g')
    .attr('class', 'arcs')
    .selectAll('path.node-arc')
    .data(layoutNodes)
    .join('path')
      .attr('class',        d => `node-arc ring-${d.ring} plane-${d.plane} leaf-role-${d.leaf_role ?? 'n-a'}`)
      .attr('id',           d => `arc-${d.id}`)
      .attr('d',            arcGen)
      .attr('fill',         d => getNodeFill(d))
      .attr('stroke',       d => getArcOverrideStroke(d, rackAzById) ?? 'var(--canvas-bg)')
      .attr('stroke-width', d => getArcOverrideStroke(d, rackAzById) ? 3 : 1.5);

  // ── Links placeholder (Phase 2) ───────────────────────────────────────────────
  // Created here (after arcs, before labels) to fix the DOM stacking order.
  // drawLinks() selects this group and populates it.
  root.append('g').attr('class', 'links');

  // ── Arc labels ────────────────────────────────────────────────────────────────
  root.append('g')
    .attr('class', 'arc-labels')
    .selectAll('text.arc-label')
    .data(layoutNodes)
    .join('text')
      .attr('class',              d => `arc-label ring-${d.ring}`)
      .attr('transform',          d => arcLabelTransform(d))
      .attr('text-anchor',        'middle')
      .attr('dominant-baseline',  'central')
      .attr('font-size',          d => arcLabelFontSize(d))
      .attr('fill',               'var(--text-primary)')    // §11.1 primary text colour, theme-aware
      .attr('pointer-events',     'none')
      .style('user-select',       'none')
      // Hide label if arc is too narrow (§8.4 degradation placeholder)
      .attr('opacity', d => {
        const spanDeg = (d.endAngle - d.startAngle) * 180 / Math.PI;
        return spanDeg >= (MIN_LABEL_DEG[d.ring] ?? 5) ? 1 : 0;
      })
      .text(d => d.label);

  // ── Ring-name labels ──────────────────────────────────────────────────────────
  // Small italic labels at 12 o'clock, placed in the inter-ring gap just
  // outside each ring's own outer radius so they never overlap arc labels.
  const ringBandEntries = populatedRings.map(r => [r, bands[r]]);
  const ringLabelData = ringBandEntries.map(([ring, band], i) => {
    const nextBand = ringBandEntries[i + 1]?.[1];
    const radius = nextBand
      ? (band.outerRadius + nextBand.innerRadius) / 2
      : band.outerRadius + 14;
    return { ring, label: RING_NAMES[ring] ?? ring, y: -radius };
  });

  root.append('g')
    .attr('class', 'ring-name-labels')
    .selectAll('text.ring-name')
    .data(ringLabelData)
    .join('text')
      .attr('class',             'ring-name')
      .attr('x',                 0)
      .attr('y',                 d => d.y)
      .attr('text-anchor',       'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size',         '10px')
      .attr('font-style',        'italic')
      .attr('fill',              'var(--text-secondary)')    // §11.1 secondary/muted text, theme-aware
      .attr('pointer-events',    'none')
      .text(d => d.label);

  // ── Centre label ──────────────────────────────────────────────────────────────
  root.append('text')
    .attr('class',             'centre-label')
    .attr('x',                 0)
    .attr('y',                 0)
    .attr('text-anchor',       'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size',         '11px')
    .attr('fill',              'var(--text-secondary)')    // §11.1 secondary/muted text, theme-aware
    .text(meta?.option ? `Option ${meta.option}` : '');

  // Note: MAAS control-plane rack-controller data (§7.7) is surfaced exclusively
  // via the tooltip's "MAAS Control Plane" section (§8.6) — no arc badge is
  // rendered here; the rack arc itself carries no controller-count indicator.

  console.log(
    `[topology] Phase 1 rings complete — ${layoutNodes.length} arcs across`,
    [...new Set(layoutNodes.map(n => n.ring))].join(', ')
  );

  // Return for use by subsequent phases.
  // Phase 2 calls drawLinks(root, layoutNodes, links) after this.
  return { svg, root, layoutNodes, links, bands, populatedRings };
}


// ── Label helpers ─────────────────────────────────────────────────────────────

/**
 * arcLabelTransform — positions and rotates text at the angular/radial midpoint
 * of the arc.  Text is rotated tangent to the arc; arcs in the bottom half of
 * the circle are flipped 180° so text always reads left-to-right.
 */
function arcLabelTransform(node) {
  const midAngle  = (node.startAngle + node.endAngle) / 2;
  const midRadius = (node.innerRadius + node.outerRadius) / 2;

  // D3 arc angles: 0 = 12 o'clock, clockwise.
  // x = r·sin(θ), y = -r·cos(θ)  (standard Cartesian from D3 polar convention)
  const x = midRadius * Math.sin(midAngle);
  const y = -midRadius * Math.cos(midAngle);

  // Tangent rotation: subtract 90° to align text along the arc.
  // Flip if arc midpoint is past 6 o'clock (> π) so text is never upside-down.
  let rotDeg = (midAngle * 180 / Math.PI) - 90;
  if (midAngle > Math.PI) rotDeg += 180;

  return `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${rotDeg.toFixed(1)})`;
}

/**
 * arcLabelFontSize — smaller text for denser outer rings.
 */
function arcLabelFontSize(node) {
  switch (node.ring) {
    case 'R1': return '10px';
    case 'R2': return '9px';
    case 'R3': return '9px';
    case 'R4': return '8.5px';
    case 'R5': return '8px';
    case 'R6': return '7px';
    default:   return '8px';
  }
}

// ── Phase 2 ───────────────────────────────────────────────────────────────────

/**
 * drawLinks(root, layoutNodes, links)
 *
 * Phase 2/5: draws every parent/child link in the fixture as a tree-of-life
 * radial/circular path, colour-coded by plane/type (§6.2) and offset into a
 * parallel "cable" lane per plane/type where multiple links share a gap (§6.6).
 *
 * Key structural test (spec §6.5): dual-leaf racks (rack-1, rack-2, rack-3)
 * will naturally show TWO leaf→rack curves per plane — one from each leaf
 * parent — with no special-case code.  This is the validation that the
 * ring/link separation correctly handles the multi-parent case.
 *
 * Exclusions (spec §6.1):
 *   - Pod→rack containment links (R1↔R5) are filtered out below — the routing
 *     path through spine/leaf/border-leaf already expresses that containment.
 *   - Same-ring peer-adjacency links (§6.1a) are NOT excluded — they render
 *     via the virtual-gap branch in radialLinkPath(), though the Option C
 *     fixture doesn't currently contain any (Option B only).
 */
export function drawLinks(root, layoutNodes, links) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));

  // Only draw links where both endpoints resolved to layout nodes,
  // and exclude pod→rack containment links (R1↔R5) — the routing path
  // through spine/leaf already expresses that containment relationship.
  const drawable = links.filter(l => {
    if (!nodeById.has(l.source) || !nodeById.has(l.target)) return false;
    const s = nodeById.get(l.source);
    const t = nodeById.get(l.target);
    if ((s.ring === 'R1' && t.ring === 'R5') ||
        (s.ring === 'R5' && t.ring === 'R1')) return false;
    return true;
  });

  root.select('.links')
    .selectAll('path.link')
    .data(drawable, d => `${d.source}→${d.target}`)  // key by endpoint pair
    .join('path')
      .attr('class',       d => `link plane-${d.plane} type-${d.type}`)
      .attr('data-source', d => d.source)
      .attr('data-target', d => d.target)
      .attr('data-plane',  d => d.plane)
      .attr('d', d => radialLinkPath(
        nodeById.get(d.source),
        nodeById.get(d.target),
        d
      ))
      .attr('fill',         'none')
      .attr('stroke',       d => LINK_COLORS[linkColorKey(d)] ?? LINK_COLORS.shared)
      .attr('stroke-width', 1)
      .attr('opacity',      d => LINK_OPACITY[linkColorKey(d)] ?? LINK_OPACITY.shared)
    .append('title')
      // Native tooltip (replaced by styled panel in Phase 4)
      .text(d => `${d.source} → ${d.target}\nPlane: ${d.plane}  Type: ${d.type}`);

  console.log(
    `[topology] Phase 2 links drawn — ${drawable.length} links`,
    `(${drawable.filter(l => l.plane === 'data').length} data,`,
    `${drawable.filter(l => l.plane === 'mgmt').length} mgmt,`,
    `${drawable.filter(l => l.plane === 'shared').length} containment)`
  );
}

// ── Link path helpers ─────────────────────────────────────────────────────────

/** Compact fixed-precision formatter for SVG coordinates. */
const f = v => v.toFixed(2);

/**
 * makeTreePath(r_src, a_src, r_arc, a_arc_entry, a_arc_exit, r_tgt, a_tgt) → SVG path
 *
 * D3 "Tree of Life" style path with the arc floating in the inter-ring gap:
 *
 *   M  source point         (inner-ring outer edge at a_src)
 *   L  arc entry point      (arc circle at a_arc_entry — stub, diagonal when bundled)
 *   A  arc at r_arc         (from a_arc_entry to a_arc_exit — always short arc)
 *   L  target point         (outer-ring inner edge at a_tgt)
 *
 * Plain paths (β=0): a_arc_entry = a_src, a_arc_exit = a_tgt
 *   → stub is radial, arc sweeps to target column, exit is radial. No diagonals.
 *
 * Bundled paths (β>0): a_arc_entry = circularBlend(a_src, group_centroid_src, β)
 *                      a_arc_exit  = a_tgt (unchanged)
 *   → stub is a tiny diagonal in the inter-ring gap (≤18 px, barely visible).
 *   → arc sweeps from the deflected entry to each target's actual angle.
 *   → exit L is always radial. No diagonal artifacts into the target ring.
 *
 * Full-circle (pod) special case: a_src = a_tgt, a_arc_entry = a_arc_exit = a_tgt
 *   → arc degenerates to a point → path collapses to two radial stubs (M→L→L).
 */
export function makeTreePath(r_src, a_src, r_arc, a_arc_entry, a_arc_exit, r_tgt, a_tgt) {
  const x0 = r_src * Math.sin(a_src);
  const y0 = -r_src * Math.cos(a_src);
  const xe = r_arc * Math.sin(a_arc_entry);   // stub endpoint / arc entry
  const ye = -r_arc * Math.cos(a_arc_entry);
  const x1 = r_arc * Math.sin(a_arc_exit);    // arc exit
  const y1 = -r_arc * Math.cos(a_arc_exit);
  const x3 = r_tgt * Math.sin(a_tgt);
  const y3 = -r_tgt * Math.cos(a_tgt);

  // Shortest-arc sweep direction (1 = CW, 0 = CCW)
  let diff = a_arc_exit - a_arc_entry;
  while (diff >  Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  const sweep = diff >= 0 ? 1 : 0;
  const ra = r_arc.toFixed(2);

  if (Math.abs(diff) < 0.001) {
    // Degenerate arc → two radial stubs (pod full-circle case)
    return `M${f(x0)},${f(y0)} L${f(xe)},${f(ye)} L${f(x3)},${f(y3)}`;
  }

  return (
    `M${f(x0)},${f(y0)} ` +
    `L${f(xe)},${f(ye)} ` +
    `A${ra},${ra} 0 0,${sweep} ${f(x1)},${f(y1)} ` +
    `L${f(x3)},${f(y3)}`
  );
}

/**
 * §6.6 Parallel lane offset — fixed px offset per plane/type lane so that
 * links which would otherwise coincide (e.g. a Data leaf and its paired
 * Management leaf serving the same rack at a near-identical angle, §5.2
 * step 5) render as visually distinct parallel "cable" strands instead of
 * a single overlapping stroke. Applied to the arc-segment radius only —
 * radial entry/exit segments still terminate exactly at each node's own
 * angular position (§6.6).
 */
const LANE_OFFSET_PX = {
  data:           -1.5,   // innermost lane
  mgmt:            1.5,   // outermost lane
  shared:          0,     // centered — never coexists with data/mgmt in one gap
  peer_adjacency:  0,     // own virtual gap; offset reserved for future multi-peer case
};

// Approximate inter-ring gap width (px) — used to place the virtual gap for
// same-ring peer-adjacency links (§6.1a) just outside the shared ring's own
// outer radius, mirroring the real inter-ring gap width (§11.3: 18–20 px).
const VIRTUAL_GAP_PX = 20;

/**
 * radialLinkPath(sourceNode, targetNode, linkDatum) → SVG path string
 *
 * Standard (inter-ring) case: plain tree-of-life path — radial stub to gap
 * midpoint (offset per lane, §6.6), arc to target angle, radial drop.
 * Full-circle pod degenerates to two radial stubs.
 *
 * Same-ring case (§6.1a): source and target share a `ring` — there is no
 * adjacent-ring gap to float the arc in, so the gap midpoint is placed at a
 * small fixed radial offset just outside the shared ring's own outer radius
 * (a "virtual ring" one gutter-width beyond the ring band), per spec §6.1a.
 */
function radialLinkPath(sourceNode, targetNode, linkDatum) {
  const laneOffset = LANE_OFFSET_PX[linkColorKey(linkDatum)] ?? 0;

  if (sourceNode.ring === targetNode.ring) {
    // §6.1a — same-ring peer-adjacency exception.
    const a_src = (sourceNode.startAngle + sourceNode.endAngle) / 2;
    const a_tgt = (targetNode.startAngle + targetNode.endAngle) / 2;
    const r_edge = sourceNode.outerRadius;
    const r_virtual = r_edge + VIRTUAL_GAP_PX / 2 + laneOffset;
    return makeTreePath(r_edge, a_src, r_virtual, a_src, a_tgt, r_edge, a_tgt);
  }

  const [inner, outer] = sourceNode.outerRadius <= targetNode.outerRadius
    ? [sourceNode, targetNode]
    : [targetNode, sourceNode];

  const a_inner = (inner.startAngle + inner.endAngle) / 2;
  const a_outer = (outer.startAngle + outer.endAngle) / 2;
  const r_src   = inner.outerRadius;
  const r_tgt   = outer.innerRadius;
  const r_arc   = (r_src + r_tgt) / 2 + laneOffset;

  const isFullCircle = (inner.endAngle - inner.startAngle) >= TWO_PI * 0.99;
  const a_src = isFullCircle ? a_outer : a_inner;

  // Plain: entry = a_src (radial stub), exit = a_outer (radial exit)
  return makeTreePath(r_src, a_src, r_arc, a_src, a_outer, r_tgt, a_outer);
}


