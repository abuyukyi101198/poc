/**
 * render.js — Phase 1
 *
 * Draws the static ring geometry: one arc segment per node, subtle ring-band
 * guide circles, and arc labels.  No links, no interaction yet.
 *
 * Phase 2 will add links (plain, then bundled in Phase 3).
 * Phase 4 will add hover/focus and plane toggles.
 * Phase 5 will apply full Canonical/Ubuntu visual styling.
 */

import * as d3 from 'd3';
import { computeLayout, CONFIG, RING_BANDS, RING_COLORS } from './layout.js';

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

/**
 * init(rootSelector)
 * Renders Phase 1 geometry into the SVG element matched by rootSelector.
 * Returns { layoutNodes, links } for inspection / use by later phases.
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
  // Thin circles at each ring's outer boundary give visual structure before arcs
  // fill in.  Inner boundaries are implied by the arc inner radii.
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
  // innerRadius / outerRadius / startAngle / endAngle are read directly from
  // each layoutNode datum.
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
      // Native tooltip — replaced by styled tooltip in Phase 4
      .text(d => {
        const spanDeg = ((d.endAngle - d.startAngle) * 180 / Math.PI).toFixed(1);
        return `${d.label}\nRing: ${d.ring}  Plane: ${d.plane}  Weight: ${d.weight}\nArc span: ${spanDeg}°`;
      });

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
    `[topology] Phase 1 render complete — ${layoutNodes.length} arcs drawn across`,
    [...new Set(layoutNodes.map(n => n.ring))].join(', ')
  );

  // Return for use by subsequent phases (Phase 2 will add links on top)
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


