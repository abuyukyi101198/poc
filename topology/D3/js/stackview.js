/**
 * stackview.js — §12 Stack View: Multi-Pod Layered Overview
 *
 * Implements the back-to-back icicle chart specified in
 * radial-layered-topology-viz-spec.md §12: a mirrored, plane-split layer
 * stack (Superspine/Spine/Leaf), bookended by two unifying, non-plane-
 * specific bands (Pod at the y=0 baseline, Rack as the outer cap). No
 * link/edge lines are drawn anywhere (§12.8) — every relationship is
 * implied purely by containment/x-nesting. No text labels are drawn either
 * (node identity is available via native hover tooltips) — this is a single
 * dense visual, not an annotated chart.
 *
 * x-axis note: pod columns are ordered and sized proportional to their real
 * IP block span (§12.2), but the *unpodded* address space between blocks is
 * deliberately NOT represented to scale — only pods that actually contain
 * infrastructure are drawn, separated by a small fixed gap, so the chart
 * doesn't waste most of its width on empty address ranges.
 *
 * Only meaningful for fixtures with 2+ R1 Pod nodes carrying
 * `metadata.cidr` (currently: Option D only — wired up in index.html).
 *
 * Documented simplifications vs. the full spec:
 *   - §12.5's strict "parent width = union of children x-extents" rule is
 *     followed literally only for R2 Superspine, which genuinely serves
 *     every pod via full-mesh redundancy (its true union IS the full
 *     multi-pod extent, rendered as thin stacked sub-lanes so sibling
 *     superspines don't overlap). R3 Spine / R4 Leaf are instead weight-
 *     subdivided directly within their own pod's column — a true DAG-union
 *     would otherwise force overlapping ranges for full-mesh siblings,
 *     which a non-overlapping partition can't represent without per-parent
 *     lane-splitting (deferred, see spec §11.5-style future-work note).
 *   - §12.6's "as evenly as possible" rack weight-split is implemented as a
 *     literal 50/50 half-height split. AZ-contiguity grouping (the other
 *     half of §12.6) IS implemented via sort order before x-subdivision.
 */

import * as d3 from 'd3';
import { getAZColor } from './layout.js';
import { parseCidr } from './ip.js';

const CONFIG = {
  width:   1400,
  marginX: 12,
  colGap:  10,   // fixed px gap between adjacent pod columns (real address gaps are NOT represented, see module doc)
  rowGap:  3,    // fixed px gap between adjacent layer bands (vertical)
};

// Layer thicknesses (px), inner→outer, one arm — spec §12.3 order.
const THICKNESS = {
  pod:        12,   // half-height of the mirrored Pod band (§12.4)
  superspine: 16,
  spine:      16,
  leaf:       14,
  rackMax:    46,   // max half-height for the heaviest rack (§12.6)
};

// Cumulative offsets from the y=0 baseline, one arm — computed once since
// THICKNESS is fixed regardless of fixture content.
const SS_START = THICKNESS.pod + CONFIG.rowGap;
const SP_START = SS_START + THICKNESS.superspine + CONFIG.rowGap;
const LF_START = SP_START + THICKNESS.spine + CONFIG.rowGap;
const RK_START = LF_START + THICKNESS.leaf + CONFIG.rowGap;
const ARM_HEIGHT = RK_START + THICKNESS.rackMax;

const HEIGHT = ARM_HEIGHT * 2 + 8;   // small top/bottom breathing room, no label margin needed

/** Subdivide [x0,x1] among `items` proportional to weight (fixture order). */
function subdivide(items, x0, x1) {
  const totalW = items.reduce((s, n) => s + (n.weight || 0), 0);
  const span = x1 - x0;
  let cursor = x0;
  return items.map(n => {
    const w = totalW > 0 ? (n.weight || 0) / totalW * span : span / items.length;
    const box = { node: n, x0: cursor, x1: cursor + w };
    cursor += w;
    return box;
  });
}

/**
 * renderStackView(selector, nodes, links, meta)
 * Draws the multi-pod Stack View into the SVG matched by `selector`.
 * `nodes`/`links` are the raw fixture arrays (same shape passed to
 * render.js's init()) — layout.js's radial computeLayout() is NOT used here,
 * Stack View has its own linear layout entirely.
 */
export function renderStackView(selector, nodes, links, meta = {}) {
  const svg = d3.select(selector);
  svg.selectAll('*').remove();

  const pods = nodes.filter(n => n.ring === 'R1' && n.metadata?.cidr);
  if (pods.length === 0) return;

  svg.attr('width', CONFIG.width).attr('height', HEIGHT);
  svg.attr('viewBox', `0 0 ${CONFIG.width} ${HEIGHT}`);

  // ── x-axis: pods ordered/sized by real IP block span (§12.2), but the
  // unpodded address space between blocks is compressed to a small fixed
  // gap rather than drawn to true scale — only pods with actual
  // infrastructure occupy width in this chart. ─────────────────────────────
  const ranges = new Map(pods.map(p => [p.id, parseCidr(p.metadata.cidr)]));
  const sortedPods = [...pods].sort((a, b) => ranges.get(a.id).start - ranges.get(b.id).start);
  const spans = sortedPods.map(p => {
    const r = ranges.get(p.id);
    return r.end - r.start + 1;
  });
  const totalSpan = spans.reduce((a, b) => a + b, 0);
  const usableWidth = CONFIG.width - CONFIG.marginX * 2 - CONFIG.colGap * (sortedPods.length - 1);

  const podCols = new Map();
  let cursor = CONFIG.marginX;
  sortedPods.forEach((p, i) => {
    const w = totalSpan > 0 ? (spans[i] / totalSpan) * usableWidth : usableWidth / sortedPods.length;
    podCols.set(p.id, { x0: cursor, x1: cursor + w });
    cursor += w + CONFIG.colGap;
  });
  const fullX0 = podCols.get(sortedPods[0].id).x0;
  const fullX1 = podCols.get(sortedPods[sortedPods.length - 1].id).x1;

  // ── Bucket every non-Pod, non-Superspine node by its owning pod ────────
  // (metadata.pod is stamped on fixture nodes — see data/option-d.js)
  const podOf = n => (n.ring === 'R1' ? n.id : n.metadata?.pod);
  const byPod = new Map(pods.map(p => [p.id, {
    spineData: [], spineMgmt: [], leafData: [], leafMgmt: [], racks: [],
  }]));
  nodes.forEach(n => {
    if (n.ring === 'R1' || n.ring === 'R2' || n.ring === 'R6') return;
    const bucket = byPod.get(podOf(n));
    if (!bucket) return;
    if (n.ring === 'R3') (n.plane === 'mgmt' ? bucket.spineMgmt : bucket.spineData).push(n);
    else if (n.ring === 'R4') (n.plane === 'mgmt' ? bucket.leafMgmt : bucket.leafData).push(n);
    else if (n.ring === 'R5') bucket.racks.push(n);
  });

  const superspines = nodes.filter(n => n.ring === 'R2');
  const dataSS = superspines.filter(n => n.plane === 'data');
  const mgmtSS = superspines.filter(n => n.plane === 'mgmt');
  const maxRackWeight = Math.max(1, ...nodes.filter(n => n.ring === 'R5').map(n => n.weight || 0));

  const root = svg.append('g')
    .attr('class', 'stack-root')
    .attr('transform', `translate(0, ${ARM_HEIGHT + 4})`);   // y=0 baseline

  const boxes = [];   // flattened { x0,x1,y0,y1, fill, node, ring }

  // ── R1 Pod — mirrored baseline band (§12.4) ─────────────────────────────
  pods.forEach(p => {
    const col = podCols.get(p.id);
    boxes.push({
      x0: col.x0, x1: col.x1, y0: -THICKNESS.pod, y1: THICKNESS.pod,
      fill: 'var(--ring-r1)', node: p, ring: 'R1',
    });
  });

  // ── R2 Superspine — full multi-pod width, stacked sub-lanes (§12.5) ─────
  const ssLaneMgmt = THICKNESS.superspine / Math.max(1, mgmtSS.length);
  mgmtSS.forEach((n, i) => boxes.push({
    x0: fullX0, x1: fullX1,
    y0: SS_START + i * ssLaneMgmt, y1: SS_START + (i + 1) * ssLaneMgmt,
    fill: 'var(--plane-r2-mgmt)', node: n, ring: 'R2',
  }));
  const ssLaneData = THICKNESS.superspine / Math.max(1, dataSS.length);
  dataSS.forEach((n, i) => boxes.push({
    x0: fullX0, x1: fullX1,
    y0: -(SS_START + (i + 1) * ssLaneData), y1: -(SS_START + i * ssLaneData),
    fill: 'var(--plane-r2-data)', node: n, ring: 'R2',
  }));

  // ── R3 Spine — per-pod, weight-subdivided across the full pod column ───
  const spineYMgmt = [SP_START, SP_START + THICKNESS.spine];
  const spineYData = [-(SP_START + THICKNESS.spine), -SP_START];
  pods.forEach(p => {
    const b = byPod.get(p.id);
    const col = podCols.get(p.id);
    subdivide(b.spineMgmt, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({ x0, x1, y0: spineYMgmt[0], y1: spineYMgmt[1], fill: 'var(--plane-r3-mgmt)', node, ring: 'R3' }));
    subdivide(b.spineData, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({ x0, x1, y0: spineYData[0], y1: spineYData[1], fill: 'var(--plane-r3-data)', node, ring: 'R3' }));
  });

  // ── R4 Leaf — per-pod, weight-subdivided (Border Leaves on the data arm) ─
  const leafYMgmt = [LF_START, LF_START + THICKNESS.leaf];
  const leafYData = [-(LF_START + THICKNESS.leaf), -LF_START];
  pods.forEach(p => {
    const b = byPod.get(p.id);
    const col = podCols.get(p.id);
    subdivide(b.leafMgmt, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({ x0, x1, y0: leafYMgmt[0], y1: leafYMgmt[1], fill: 'var(--plane-r4-mgmt)', node, ring: 'R4' }));
    subdivide(b.leafData, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({
        x0, x1, y0: leafYData[0], y1: leafYData[1],
        fill: node.leaf_role === 'border' ? 'var(--border-leaf-fill)' : 'var(--plane-r4-data)',
        node, ring: 'R4',
      }));
  });

  // ── R5 Rack — outer unifying cap; AZ-grouped, weight-driven height (§12.6) ─
  pods.forEach(p => {
    const b = byPod.get(p.id);
    const col = podCols.get(p.id);
    const sorted = [...b.racks].sort((a, c) =>
      (a.availability_zone ?? '').localeCompare(c.availability_zone ?? '') || a.id.localeCompare(c.id));
    subdivide(sorted, col.x0, col.x1).forEach(({ node, x0, x1 }) => {
      const halfH = Math.max(2, (node.weight || 0) / maxRackWeight * THICKNESS.rackMax / 2);
      const fill = getAZColor(node.availability_zone) ?? 'var(--ring-r5)';
      // Two mirrored half-height segments sharing one AZ fill — one entity
      // split across the mirror line rather than two unrelated rectangles.
      boxes.push({ x0, x1, y0: RK_START, y1: RK_START + halfH, fill, node, ring: 'R5' });
      boxes.push({ x0, x1, y0: -(RK_START + halfH), y1: -RK_START, fill, node, ring: 'R5' });
    });
  });

  // ── Draw all boxes (no link lines, no text labels — §12.8) ──────────────
  // Node identity is available via native hover tooltips only.
  root.append('g').attr('class', 'stack-boxes')
    .selectAll('rect')
    .data(boxes)
    .join('rect')
      .attr('class', d => `stack-box ring-${d.ring}`)
      .attr('x',      d => d.x0)
      .attr('y',      d => d.y0)
      .attr('width',  d => Math.max(0.5, d.x1 - d.x0))
      .attr('height', d => Math.max(0.5, d.y1 - d.y0))
      .attr('fill',   d => d.fill)
      .attr('stroke', 'var(--canvas-bg)')
      .attr('stroke-width', 0.5)
    .append('title')
      .text(d => `${d.node.label} — ${d.node.ring}${d.node.availability_zone && d.node.availability_zone !== 'n/a' ? ` · ${d.node.availability_zone}` : ''}`);

  // ── Baseline guide (faint structural cue, not a label) ──────────────────
  root.append('line')
    .attr('x1', fullX0).attr('x2', fullX1)
    .attr('y1', 0).attr('y2', 0)
    .attr('stroke', 'var(--ring-guide-stroke)').attr('stroke-width', 1);
}






