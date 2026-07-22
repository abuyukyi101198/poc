/**
 * render.js — Phase 1 + 2 + 3 + 5
 *
 * Phase 1: static ring geometry — arc segments, guide circles, labels.
 * Phase 2: plain (unbundled) radial links, plane-colour-coded.
 * Phase 3: hierarchical edge bundling via bundling.js (§6.4).
 * Phase 5: Canonical/Ubuntu brand colours — on-palette tint values at full
 *          opacity, graduated warm grey ring fills, label colour corrections.
 *
 * Phase 4 hover/focus and plane toggles are in interaction.js.
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

// ── Phase 5 link colours — Canonical/Ubuntu brand palette, on-palette tints ───
//
// Key change from Phases 2–3: colours are defined as TINT VALUES at full
// opacity (opacity=1), NOT as arbitrary CSS opacity fades.  Using the official
// Canonical tint percentages keeps every shade "on-palette" (action plan §6.1).
//
// Resting state (tinted):
//   Ubuntu Orange #E95420 at 67% tint  →  R:240 G:141 B:106  →  #F08D6A
//   Aubergine     #772953 at 67% tint  →  R:164 G:112 B:140  →  #A4708C
//   Warm grey skeleton — light tint, always subdued
//
// Hover/focus state: full-strength base colours (applied by interaction.js §8.3)
//   #E95420 (Ubuntu Orange full) / #772953 (Aubergine full) / #AEA9A5 (warm grey)
export const LINK_COLORS = {
  data:   '#F08D6A',   // Ubuntu Orange at 67% tint — resting
  mgmt:   '#A4708C',   // Aubergine at 67% tint — resting
  shared: '#D8D1CA',   // Canonical warm grey — physical containment skeleton
};

// All planes at full opacity — the tint colour carries the visual weight,
// not a CSS opacity fade (action plan §6.1 "rather than arbitrary opacity").
export const LINK_OPACITY = {
  data:   1,
  mgmt:   1,
  shared: 1,
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
      .attr('class',              d => `arc-label ring-${d.ring}`)
      .attr('transform',          d => arcLabelTransform(d))
      .attr('text-anchor',        'middle')
      .attr('dominant-baseline',  'central')
      .attr('font-size',          d => arcLabelFontSize(d))
      .attr('fill',               '#111111')    // Canonical primary text colour
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
 * radialLinkPath(sourceNode, targetNode) → SVG path string
 *
 * Plain (unbundled) tree-of-life path: radial stub to gap midpoint, arc to
 * target angle, radial drop.  Full-circle pod degenerates to two radial stubs.
 */
function radialLinkPath(sourceNode, targetNode) {
  const [inner, outer] = sourceNode.outerRadius <= targetNode.outerRadius
    ? [sourceNode, targetNode]
    : [targetNode, sourceNode];

  const a_inner = (inner.startAngle + inner.endAngle) / 2;
  const a_outer = (outer.startAngle + outer.endAngle) / 2;
  const r_src   = inner.outerRadius;
  const r_tgt   = outer.innerRadius;
  const r_arc   = (r_src + r_tgt) / 2;

  const isFullCircle = (inner.endAngle - inner.startAngle) >= TWO_PI * 0.99;
  const a_src = isFullCircle ? a_outer : a_inner;

  // Plain: entry = a_src (radial stub), exit = a_outer (radial exit)
  return makeTreePath(r_src, a_src, r_arc, a_src, a_outer, r_tgt, a_outer);
}


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

