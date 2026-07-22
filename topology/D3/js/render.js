/**
 * render.js — Phase 1 + 2 + 3
 *
 * Phase 1: static ring geometry — arc segments, guide circles, labels.
 * Phase 2: plain (unbundled) radial links for every parent/child relationship,
 *          with plane colour coding (§6.2, Canonical brand palette).
 * Phase 3: hierarchical edge bundling — applyBundling() replaces Phase 2
 *          plain Bezier paths with bundled paths from bundling.js (§6.4).
 *
 * Phase 4 will add hover/focus and plane toggles (interaction.js).
 * Phase 5 will apply full Canonical/Ubuntu visual styling.
 */

import * as d3 from 'd3';
import { computeLayout, CONFIG, RING_BANDS, RING_COLORS } from './layout.js';
import { computeBundledPaths } from './bundling.js';

// Minimum arc span (degrees) at which an inline label is shown.
// Arcs narrower than this degrade to tooltip-only (§8.4).
const MIN_LABEL_DEG = {
  R1: 0,    // Pod: always labelled
  R3: 3,    // Spines: large arcs, always visible
  R4: 3,    // Leaves
  R5: 4,    // Racks
  R6: 6,    // Servers: small arcs — only label if there is room
};

// Human-readable ring names for the legend band
const RING_NAMES = {
  R1: 'Pod',
  R3: 'Spine',
  R4: 'Leaf',
  R5: 'Rack',
  R6: 'Server',
};

// ── Phase 2 link colours — Canonical/Ubuntu brand palette (action plan §6.1) ──
// Resting-state tints (~60% white mix of the base colour).
// Full-strength base on hover/focus in Phase 4.
// Phase 5 will lock in the exact published Canonical tint percentages.
//
//   Ubuntu Orange base: #E95420  → 60% tint: #F29879
//   Aubergine base:     #772953  → 60% tint: #AD7F98
//   Warm grey (containment skeleton, should visually recede)
//
// NOTE: action plan §6.1 maps spec §6.2's placeholder "blue/green" language
// to Orange (data) and Aubergine (mgmt) — these are NOT the spec's colours.
export const LINK_COLORS = {
  data:   '#F29879',   // Ubuntu Orange at ~60% tint
  mgmt:   '#AD7F98',   // Aubergine at ~60% tint
  shared: '#C8C2BC',   // Warm grey — physical containment skeleton
};

// Opacity separates the "structural skeleton" (containment) from the
// routing-plane links that are the primary information signal.
// Exported so Phase 4 interaction.js can restore resting opacity after hover.
export const LINK_OPACITY = {
  data:   0.65,
  mgmt:   0.65,
  shared: 0.25,   // containment links strongly recede (spec §6.2)
};

const TWO_PI = 2 * Math.PI;

/**
 * init(rootSelector)
 * Renders ring geometry into the SVG element matched by rootSelector.
 * Creates a `links` placeholder group in the correct DOM stacking order
 * so Phase 2's drawLinks() can populate it without re-ordering elements.
 * Returns { svg, root, layoutNodes, links }.
 */
export function init(rootSelector = '#topology') {
  const { layoutNodes, links } = computeLayout();

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
    .data(Object.values(RING_BANDS))
    .join('circle')
      .attr('r',            d => d.outerRadius)
      .attr('fill',         'none')
      .attr('stroke',       '#e4deda')
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
  root.append('g')
    .attr('class', 'arcs')
    .selectAll('path.node-arc')
    .data(layoutNodes)
    .join('path')
      .attr('class',        d => `node-arc ring-${d.ring} plane-${d.plane}`)
      .attr('id',           d => `arc-${d.id}`)
      .attr('d',            arcGen)
      .attr('fill',         d => RING_COLORS[d.ring] ?? '#ccc')
      .attr('stroke',       '#ffffff')
      .attr('stroke-width', 1.5)
    .append('title')
      .text(d => {
        const spanDeg = ((d.endAngle - d.startAngle) * 180 / Math.PI).toFixed(1);
        return `${d.label}\nRing: ${d.ring}  Plane: ${d.plane}  Weight: ${d.weight}\nArc span: ${spanDeg}°`;
      });

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
      .attr('class',              'arc-label')
      .attr('transform',          d => arcLabelTransform(d))
      .attr('text-anchor',        'middle')
      .attr('dominant-baseline',  'central')
      .attr('font-size',          d => arcLabelFontSize(d))
      .attr('fill',               '#3d3531')
      .attr('pointer-events',     'none')
      .style('user-select',       'none')
      // Hide label if arc is too narrow (§8.4 degradation placeholder)
      .attr('opacity', d => {
        const spanDeg = (d.endAngle - d.startAngle) * 180 / Math.PI;
        return spanDeg >= (MIN_LABEL_DEG[d.ring] ?? 5) ? 1 : 0;
      })
      .text(d => d.label);

  // ── Ring-name labels ──────────────────────────────────────────────────────────
  // Small italic labels placed just inside the inner edge of each ring band,
  // at 12 o'clock, for orientation at a glance.
  const ringLabelData = Object.entries(RING_BANDS).map(([ring, { innerRadius }]) => ({
    ring,
    label: RING_NAMES[ring] ?? ring,
    // Place text just above (negative y) the inner boundary of the ring
    y: -(innerRadius + 8),
  }));

  root.append('g')
    .attr('class', 'ring-name-labels')
    .selectAll('text.ring-name')
    .data(ringLabelData)
    .join('text')
      .attr('class',             'ring-name')
      .attr('x',                 0)
      .attr('y',                 d => d.y)
      .attr('text-anchor',       'middle')
      .attr('dominant-baseline', 'auto')
      .attr('font-size',         '10px')
      .attr('font-style',        'italic')
      .attr('fill',              '#837c78')
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
    .attr('fill',              '#837c78')
    .text('Option C');

  console.log(
    `[topology] Phase 1 rings complete — ${layoutNodes.length} arcs across`,
    [...new Set(layoutNodes.map(n => n.ring))].join(', ')
  );

  // Return for use by subsequent phases.
  // Phase 2 calls drawLinks(root, layoutNodes, links) after this.
  return { svg, root, layoutNodes, links };
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
    case 'R1': return '11px';
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
 * Phase 2: draws every parent/child link in the fixture as a plain cubic
 * Bezier curve, colour-coded by plane (§6.2, Canonical brand palette).
 *
 * Key structural test (spec §6.5): dual-leaf racks (rack-1, rack-2, rack-3)
 * will naturally show TWO leaf→rack curves per plane — one from each leaf
 * parent — with no special-case code.  This is the validation that the
 * ring/link separation correctly handles the multi-parent case.
 *
 * Exclusions (spec §6.1):
 *   - border-leaf-1 (ring='SAT') is not in layoutNodes → its link is silently
 *     dropped by the has() filter below, per the Phase 1 stub decision.
 *   - Same-ring and inter-non-adjacent-ring links: none exist in the fixture,
 *     but the filter is harmless for any that might appear in later data.
 */
export function drawLinks(root, layoutNodes, links) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));

  // Only draw links where both endpoints resolved to layout nodes.
  const drawable = links.filter(
    l => nodeById.has(l.source) && nodeById.has(l.target)
  );

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
        nodeById.get(d.target)
      ))
      .attr('fill',         'none')
      .attr('stroke',       d => LINK_COLORS[d.plane] ?? LINK_COLORS.shared)
      .attr('stroke-width', 1)
      .attr('opacity',      d => LINK_OPACITY[d.plane] ?? LINK_OPACITY.shared)
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

// ── Link path helper ──────────────────────────────────────────────────────────

/**
 * radialLinkPath(sourceNode, targetNode) → SVG path string
 *
 * Produces a cubic Bezier curve connecting the outer edge of the inner ring
 * to the inner edge of the outer ring.  Control points sit at the midpoint
 * radius between the two rings' boundaries, at each arc's midpoint angle.
 *
 * Special case — full-circle arcs (the R1 Pod node):
 *   The pod spans 0→2π, so its geometric midpoint is π (6 o'clock).
 *   Drawing all pod-originating links from the same 6 o'clock point would
 *   collapse them visually.  Instead, for full-circle arcs, the source point
 *   is placed at the TARGET's angle on the pod's outer radius — making each
 *   pod link a straight radial line at its target's angular position.
 *   (For pod→spine links the gap is only 18 px, so this barely matters;
 *   for pod→rack containment links spanning all of R3+R4 it reads clearly.)
 *
 * Implementation note — Phase 3 bundling:
 *   The control points (r_mid * sin/cos of each endpoint angle) are exactly
 *   the "attraction points" used by hierarchical edge bundling (§6.4).
 *   bundling.js will take these same control points and deflect them toward
 *   a shared trunk radius; the path signature is designed to be compatible.
 */
function radialLinkPath(sourceNode, targetNode) {
  // Ensure inner/outer orientation is consistent regardless of link direction.
  const [inner, outer] = sourceNode.outerRadius <= targetNode.outerRadius
    ? [sourceNode, targetNode]
    : [targetNode, sourceNode];

  const a_inner = (inner.startAngle + inner.endAngle) / 2;
  const a_outer = (outer.startAngle + outer.endAngle) / 2;

  const r_src  = inner.outerRadius;    // link starts at outer edge of inner ring
  const r_tgt  = outer.innerRadius;    // link ends   at inner edge of outer ring
  const r_mid  = (r_src + r_tgt) / 2; // control-point radius

  // For a full-circle arc (Pod, R1), draw from the target's angle so each
  // link is a straight radial line rather than all converging at 6 o'clock.
  const isFullCircle = (inner.endAngle - inner.startAngle) >= TWO_PI * 0.99;
  const a_src = isFullCircle ? a_outer : a_inner;

  // Cartesian coordinates — D3 polar convention: 0 = top, clockwise.
  //   x =  r · sin(θ),   y = -r · cos(θ)
  const x0 = r_src * Math.sin(a_src);
  const y0 = -r_src * Math.cos(a_src);
  const x1 = r_mid * Math.sin(a_src);   // CP1: inner-ring angle, mid radius
  const y1 = -r_mid * Math.cos(a_src);
  const x2 = r_mid * Math.sin(a_outer); // CP2: outer-ring angle, mid radius
  const y2 = -r_mid * Math.cos(a_outer);
  const x3 = r_tgt * Math.sin(a_outer);
  const y3 = -r_tgt * Math.cos(a_outer);

  return (
    `M${x0.toFixed(2)},${y0.toFixed(2)} ` +
    `C${x1.toFixed(2)},${y1.toFixed(2)} ` +
    `${x2.toFixed(2)},${y2.toFixed(2)} ` +
    `${x3.toFixed(2)},${y3.toFixed(2)}`
  );
}

// ── Phase 3 ───────────────────────────────────────────────────────────────────

/**
 * applyBundling(root, layoutNodes, links, bundleStrength?)
 *
 * Phase 3: replaces the plain Bezier path on each drawn link element with a
 * hierarchically-bundled path generated by bundling.js.
 *
 * Must be called AFTER drawLinks() has created the link <path> elements and
 * bound each link datum (which carries .source and .target IDs).
 *
 * Falls back to the element's existing `d` attribute for any link not found
 * in the path map (safety net; should not occur with the current fixture).
 *
 * bundleStrength defaults to CONFIG.bundleStrength (0.7 per spec §9.2).
 * Pass a lower value (e.g. 0.4) if the ECMP visual is too compressed at the
 * current scale — the spec explicitly permits this (action plan §4 Phase 3).
 */
export function applyBundling(root, layoutNodes, links, bundleStrength = CONFIG.bundleStrength) {
  const pathMap = computeBundledPaths(layoutNodes, links, bundleStrength);

  // Update every drawn link path's `d` attribute in-place.
  // Uses a regular function (not arrow) so `this` refers to the DOM element,
  // enabling the fallback d3.select(this).attr('d') for unmatched links.
  root.selectAll('.link').attr('d', function(d) {
    return pathMap.get(`${d.source}→${d.target}`) ?? d3.select(this).attr('d');
  });

  console.log(
    `[topology] Phase 3 bundling applied — β=${bundleStrength},`,
    `${pathMap.size} link paths updated`
  );
}

