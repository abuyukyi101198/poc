/**
 * stackview.js — §12 Stack View: Multi-Pod Layered Overview
 *
 * Implements the back-to-back icicle chart specified in
 * radial-layered-topology-viz-spec.md §12: a mirrored, plane-split layer
 * stack (Superspine/Spine/Leaf), bookended by two unifying, non-plane-
 * specific bands (Pod at the y=0 baseline, Rack as the outer cap). No
 * link/edge lines are drawn anywhere (§12.8) — every relationship is
 * implied purely by containment/x-nesting.
 *
 * CIDR column labels (§12.2): each pod column displays its CIDR value as a
 * short text label above the chart, rotated −45° and offset upward into the
 * LABEL_AREA so the text fans down-left toward the arm boundary without
 * overlapping chart content. Pointer events are disabled on these labels so
 * the transparent column hit-targets (§12.10) remain the sole click surface.
 *
 * Sizing: the logical multi-pod layout spans the Disc View's canvas width
 * (layout.js CONFIG.width), then rotates into a narrow portrait SVG beside
 * the Disc. This keeps the summary legible without reducing Disc height.
 *
 * x-axis note: pod columns are ordered and sized proportional to their real
 * IP block span (§12.2), but the *unpodded* address space between blocks is
 * deliberately NOT represented to scale — only pods that actually contain
 * infrastructure are drawn, separated by a small fixed gap, so the chart
 * doesn't waste most of its width on empty address ranges.
 *
 * §12.11 Hover/tooltip: every box carries the full raw fixture node datum in
 * its D3 binding (spread directly, not nested) — the same object shape as
 * Disc View's `.node-arc` elements — so that interaction.js's
 * initLineageHover() and tooltip.js's initTooltip() could be wired up on the
 * stack SVG root without modification. HOWEVER, neither is currently called:
 * the current hover affordances are (a) column-level opacity dimming via
 * applyOpacities() and (b) a dedicated per-column pod-summary tooltip
 * (§12.11). Per-node BFS lineage highlight and the §8.6 per-node tooltip are
 * not yet active.
 *
 * Supports either reference pods (R1 nodes with `metadata.cidr`) or an
 * inferred `meta.stackView.groups` contract, such as LLDP frame/hall groups.
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
import { getAZColor, CONFIG as DISC_CONFIG } from './layout.js';
import { parseCidr } from './ip.js';
import { maasRackFill } from './maas-lenses.js';

const CONFIG = {
  width:   DISC_CONFIG.width,   // match the Disc View canvas width exactly
  marginX: 12,
  colGap:  8,    // fixed px gap between adjacent pod columns (real address gaps are NOT represented, see module doc)
  rowGap:  2,    // fixed px gap between adjacent layer bands (vertical)
};

// Layer thicknesses (px), inner→outer, one arm — spec §12.3 order.
// Deliberately compressed — this is a short summary strip above the detail
// view, not a chart meant to occupy comparable vertical space to the disc.
const THICKNESS = {
  pod:        2,    // half-height of the mirrored Pod band (§12.4)
  superspine: 3,
  spine:      3,
  leaf:       3,
  rackMax:    10,   // max half-height for the heaviest rack (§12.6)
};

// SS_START=4, SP_START=9, LF_START=14, RK_START=19, ARM_HEIGHT=29.
// LABEL_GUTTER gives the portrait view a left-side channel for horizontal
// group labels; the logical x-axis becomes the vertical screen axis.

// Cumulative offsets from the y=0 baseline, one arm — computed once since
// THICKNESS is fixed regardless of fixture content.
const SS_START = THICKNESS.pod + CONFIG.rowGap;
const SP_START = SS_START + THICKNESS.superspine + CONFIG.rowGap;
const LF_START = SP_START + THICKNESS.spine + CONFIG.rowGap;
const RK_START = LF_START + THICKNESS.leaf + CONFIG.rowGap;
const ARM_HEIGHT = RK_START + THICKNESS.rackMax;

const LABEL_AREA = 56;
const LABEL_GUTTER = 80;
const STACK_WIDTH = ARM_HEIGHT * 2 + 6 + LABEL_AREA + LABEL_GUTTER; // = 200px

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
 * renderStackView(selector, nodes, links, meta, options)
 * Draws the multi-pod Stack View into the SVG matched by `selector`.
 * `nodes`/`links` are the raw fixture arrays (same shape passed to
 * render.js's init()) — layout.js's radial computeLayout() is NOT used here,
 * Stack View has its own linear layout entirely.
 *
 * options.selectedPodId  {string|null} — id of the currently selected pod,
 *   or null for "show all". When set, every other pod's column is dimmed to
 *   DIM_OPACITY and the selected pod's column receives a highlight outline.
 * options.onSelectPod    {function}    — called with the clicked pod id
 *   (§12.10). Wired to click events on the transparent pod hit-target rects
 *   drawn over each full column. Toggling the already-selected pod passes
 *   the same id; callers decide whether to deselect.
 * options.matchedNodeIds {Set<string>} — full-fixture search matches. Matching
 *   racks remain highlighted even when Disc View is drilled into another group.
 */
export function renderStackView(selector, nodes, links, meta = {}, options = {}) {
  const {
    selectedPodId = null,
    onSelectPod = null,
    maasModel = null,
    maasLens = 'none',
    matchedNodeIds = new Set(),
  } = options;

  const svg = d3.select(selector);
  svg.selectAll('*').remove();

  const inferredGroups = meta.stackView?.groups;
  const ringNames = meta.ringNames || {};
  const groupLabel = meta.stackView?.groupLabel || 'Pod';
  const usesInferredGroups = Array.isArray(inferredGroups) && inferredGroups.length > 0;
  const pods = usesInferredGroups
    ? inferredGroups
    : nodes.filter(n => n.ring === 'R1' && n.metadata?.cidr);
  if (pods.length === 0) return;

  const stackBounds = svg.node().getBoundingClientRect();
  const viewportWidth = Math.round(stackBounds.width) || STACK_WIDTH;
  const viewportHeight = Math.round(stackBounds.height) || CONFIG.width;
  const labelGutterWidth = Math.max(72, Math.round(viewportWidth * 0.38));
  const icicleWidth = viewportWidth - labelGutterWidth;
  const horizontalScale = icicleWidth / (ARM_HEIGHT * 2);
  const verticalScale = viewportHeight / CONFIG.width;
  svg
    .attr('width', viewportWidth)
    .attr('height', viewportHeight)
    .attr('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`)
    .attr('preserveAspectRatio', 'none');

  // ── x-axis: pods ordered/sized by real IP block span (§12.2), but the
  // unpodded address space between blocks is compressed to a small fixed
  // gap rather than drawn to true scale — only pods with actual
  // infrastructure occupy width in this chart. ─────────────────────────────
  const ranges = usesInferredGroups
    ? null
    : new Map(pods.map(p => [p.id, parseCidr(p.metadata.cidr)]));
  const sortedPods = usesInferredGroups
    ? [...pods].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    : [...pods].sort((a, b) => ranges.get(a.id).start - ranges.get(b.id).start);
  const spans = usesInferredGroups
    ? sortedPods.map(p => p.weight || 1)
    : sortedPods.map(p => {
      const range = ranges.get(p.id);
      return range.end - range.start + 1;
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
  const groupIdsFor = n => {
    if (!usesInferredGroups) return [n.ring === 'R1' ? n.id : n.metadata?.pod];
    if (n.metadata?.stackGroups?.length) return n.metadata.stackGroups;
    return n.metadata?.stackGroup ? [n.metadata.stackGroup] : [];
  };
  const matchedGroupIds = new Set();
  const matchedGroupCounts = new Map();
  const matchedRackIds = new Set();
  for (const node of nodes) {
    if (!matchedNodeIds.has(node.id)) continue;
    if (node.ring === 'R5') matchedRackIds.add(node.id);
    if (node.ring === 'R6' && node.metadata?.rack) matchedRackIds.add(node.metadata.rack);

    const groupIds = groupIdsFor(node).filter(Boolean);
    const resolvedGroupIds = groupIds.length
      ? groupIds
      : node.ring === 'R2'
        ? pods.map(pod => pod.id)
        : [];
    resolvedGroupIds.forEach(groupId => {
      matchedGroupIds.add(groupId);
      matchedGroupCounts.set(groupId, (matchedGroupCounts.get(groupId) ?? 0) + 1);
    });
  }
  const searchActive = matchedGroupIds.size > 0;
  const byPod = new Map(pods.map(p => [p.id, {
    spineData: [], spineMgmt: [], leafData: [], leafMgmt: [], racks: [],
  }]));
  nodes.forEach(n => {
    if (n.ring === 'R1' || n.ring === 'R2' || n.ring === 'R6') return;
    groupIdsFor(n).forEach(groupId => {
      const bucket = byPod.get(groupId);
      if (!bucket) return;
      if (n.ring === 'R3') (n.plane === 'mgmt' ? bucket.spineMgmt : bucket.spineData).push(n);
      else if (n.ring === 'R4') (n.plane === 'mgmt' ? bucket.leafMgmt : bucket.leafData).push(n);
      else if (n.ring === 'R5') bucket.racks.push(n);
    });
  });

  const superspines = nodes.filter(n => n.ring === 'R2');
  const dataSS = superspines.filter(n => n.plane === 'data');
  const mgmtSS = superspines.filter(n => n.plane === 'mgmt');
  const maxRackWeight = Math.max(1, ...nodes.filter(n => n.ring === 'R5').map(n => n.weight || 0));

  const root = svg.append('g')
    .attr('class', 'stack-root')
    .attr(
      'transform',
      `translate(${labelGutterWidth + icicleWidth / 2 + horizontalScale * (ARM_HEIGHT + 3 + LABEL_AREA)}, 0) ` +
      `scale(${horizontalScale}, ${verticalScale}) ` +
      `rotate(90) translate(0, ${ARM_HEIGHT + 3 + LABEL_AREA})`
    );

  // Flattened list of { x0,x1,y0,y1, fill, ring, ...node }. Node fields are
  // SPREAD directly onto each box so interaction.js/tooltip.js work unchanged.
  const boxes = [];

  // ── R1 Pod — mirrored baseline band (§12.4) ─────────────────────────────
  pods.forEach(p => {
    const col = podCols.get(p.id);
    boxes.push({
      ...p,
      ring: 'R1',
      plane: 'shared',
      stackGroupId: p.id,
      x0: col.x0,
      x1: col.x1,
      y0: -THICKNESS.pod,
      y1: THICKNESS.pod,
      fill: 'var(--ring-r1)',
    });
  });

  // ── R2 Superspine — full multi-pod width, stacked sub-lanes (§12.5) ─────
  const ssLaneMgmt = THICKNESS.superspine / Math.max(1, mgmtSS.length);
  mgmtSS.forEach((n, i) => boxes.push({
    ...n, x0: fullX0, x1: fullX1,
    y0: SS_START + i * ssLaneMgmt, y1: SS_START + (i + 1) * ssLaneMgmt,
    fill: 'var(--plane-r2-mgmt)',
  }));
  const ssLaneData = THICKNESS.superspine / Math.max(1, dataSS.length);
  dataSS.forEach((n, i) => boxes.push({
    ...n, x0: fullX0, x1: fullX1,
    y0: -(SS_START + (i + 1) * ssLaneData), y1: -(SS_START + i * ssLaneData),
    fill: 'var(--plane-r2-data)',
  }));

  // ── R3 Spine ─────────────────────────────────────────────────────────────
  const spineYMgmt = [SP_START, SP_START + THICKNESS.spine];
  const spineYData = [-(SP_START + THICKNESS.spine), -SP_START];
  pods.forEach(p => {
    const b = byPod.get(p.id);
    const col = podCols.get(p.id);
    subdivide(b.spineMgmt, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({ ...node, stackGroupId: p.id, x0, x1, y0: spineYMgmt[0], y1: spineYMgmt[1], fill: 'var(--plane-r3-mgmt)' }));
    subdivide(b.spineData, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({ ...node, stackGroupId: p.id, x0, x1, y0: spineYData[0], y1: spineYData[1], fill: 'var(--plane-r3-data)' }));
  });

  // ── R4 Leaf ───────────────────────────────────────────────────────────────
  const leafYMgmt = [LF_START, LF_START + THICKNESS.leaf];
  const leafYData = [-(LF_START + THICKNESS.leaf), -LF_START];
  pods.forEach(p => {
    const b = byPod.get(p.id);
    const col = podCols.get(p.id);
    subdivide(b.leafMgmt, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({ ...node, stackGroupId: p.id, x0, x1, y0: leafYMgmt[0], y1: leafYMgmt[1], fill: 'var(--plane-r4-mgmt)' }));
    subdivide(b.leafData, col.x0, col.x1).forEach(({ node, x0, x1 }) =>
      boxes.push({
        ...node, stackGroupId: p.id, x0, x1, y0: leafYData[0], y1: leafYData[1],
        fill: node.leaf_role === 'border' ? 'var(--border-leaf-fill)' : 'var(--plane-r4-data)',
      }));
  });

  // ── R5 Rack — outer unifying cap ─────────────────────────────────────────
  pods.forEach(p => {
    const b = byPod.get(p.id);
    const col = podCols.get(p.id);
    const sorted = [...b.racks].sort((a, c) =>
      (a.availability_zone ?? '').localeCompare(c.availability_zone ?? '') || a.id.localeCompare(c.id));
    subdivide(sorted, col.x0, col.x1).forEach(({ node, x0, x1 }) => {
      const halfH = Math.max(2, (node.weight || 0) / maxRackWeight * THICKNESS.rackMax / 2);
      const lensFill = maasRackFill(node, maasLens, maasModel);
      const fill = lensFill ? `var(--maas-${lensFill.tone})` : getAZColor(node.availability_zone) ?? 'var(--ring-r5)';
      boxes.push({ ...node, stackGroupId: p.id, x0, x1, y0: RK_START, y1: RK_START + halfH, fill });
      boxes.push({ ...node, stackGroupId: p.id, x0, x1, y0: -(RK_START + halfH), y1: -RK_START, fill });
    });
  });

  // ── Draw all boxes ────────────────────────────────────────────────────────
  const resolvedPodOf = d => d.stackGroupId ?? (d.ring === 'R1' ? d.id : d.metadata?.pod ?? null);

  // Compute initial opacity from selection state. This function is also called
  // during hover to apply a transient secondary dim over non-hovered columns.
  const DIM_OPACITY   = 0.18;   // unselected columns while a pod is selected
  const HOVER_DIM     = 0.38;   // non-hovered columns during column hover (no selection active)
  const SEARCH_DIM    = 0.18;   // non-matching groups during a full-fixture search

  function applyOpacities(hoveredPodId) {
    root.selectAll('.stack-box').attr('opacity', function(d) {
      if (d.ring === 'R2') return 1;   // superspines span all pods, never dim
      const pod = resolvedPodOf(d);
      if (searchActive) {
        if (hoveredPodId === pod) return 1;
        return matchedGroupIds.has(pod) ? 1 : SEARCH_DIM;
      }
      if (hoveredPodId) {
        if (pod === hoveredPodId) return 1;
        // if a selection is active, keep the already-dimmed unselected columns
        // at DIM_OPACITY rather than the lighter HOVER_DIM so the selected vs
        // unselected contrast still reads clearly during hover.
        return (selectedPodId && pod !== selectedPodId) ? DIM_OPACITY : HOVER_DIM;
      }
      if (selectedPodId) return pod === selectedPodId ? 1 : DIM_OPACITY;
      return 1;
    });
  }

  root.append('g').attr('class', 'stack-boxes')
    .selectAll('rect')
    .data(boxes)
    .join('rect')
      .attr('class', d => `stack-box ring-${d.ring}`)
      .attr('data-pod', d => resolvedPodOf(d))
      .attr('x',      d => d.x0)
      .attr('y',      d => d.y0)
      .attr('width',  d => Math.max(0.5, d.x1 - d.x0))
      .attr('height', d => Math.max(0.5, d.y1 - d.y0))
      .attr('fill',   d => d.fill)
      .attr('stroke', 'var(--canvas-bg)')
      .attr('stroke-width', 1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'crispEdges');

  root.selectAll('.stack-box')
    .classed('search-match', d => matchedNodeIds.has(d.id) ||
      (d.ring === 'R5' && matchedRackIds.has(d.id)));

  applyOpacities(null);   // set initial state

  // ── Baseline guide ────────────────────────────────────────────────────────
  root.append('line')
    .attr('x1', fullX0).attr('x2', fullX1)
    .attr('y1', 0).attr('y2', 0)
    .attr('stroke', 'var(--ring-guide-stroke)')
    .attr('stroke-width', 1)
    .attr('vector-effect', 'non-scaling-stroke')
    .attr('shape-rendering', 'crispEdges');

  // ── Pod IP-range / group labels ───────────────────────────────────────────
  // Render labels in viewport coordinates, avoiding the icicle's non-uniform
  // scale so text remains horizontal and crisp in the left gutter.
  svg.append('g').attr('class', 'stack-labels')
    .selectAll('text')
    .data(sortedPods)
    .join('text')
      .attr('x', labelGutterWidth - 6)
      .attr('y', p => {
        const cx = (podCols.get(p.id).x0 + podCols.get(p.id).x1) / 2;
        return verticalScale * cx;
      })
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', "'Ubuntu Mono', 'Courier New', monospace")
      .attr('font-size', 11)
      .attr('letter-spacing', '0.01em')
      .attr('fill', 'var(--text-secondary)')
      .attr('pointer-events', 'none')
      .text(p => p.metadata?.cidr ?? p.label);

  // ── Pod summary tooltip ───────────────────────────────────────────────────
  // A dedicated column-level tooltip distinct from the per-node §8.6 panel,
  // summarising the hovered pod's infrastructure at a glance.
  const tooltipEl = getOrCreateStackTooltip();

  // Pre-compute per-pod summaries so we don't re-traverse nodes on every hover.
  const podSummaries = new Map(pods.map(p => {
    const b = byPod.get(p.id);
    const borderCount = b.leafData.filter(n => n.leaf_role === 'border').length;
    const accessDataCount = b.leafData.length - borderCount;
    // AZ breakdown: count racks per AZ
    const azCounts = new Map();
    b.racks.forEach(r => {
      const az = (r.availability_zone && r.availability_zone !== 'n/a') ? r.availability_zone : null;
      if (az) azCounts.set(az, (azCounts.get(az) ?? 0) + 1);
    });
    const rackHealthCounts = new Map();
    b.racks.forEach(rack => {
      const health = maasRackFill(rack, 'status', maasModel);
      if (health?.group) rackHealthCounts.set(
        health.group,
        (rackHealthCounts.get(health.group) ?? 0) + 1
      );
    });
    return [p.id, {
      pod: p,
      groupLabel,
      ringNames,
      servers: p.weight,
      racks: b.racks.length,
      coreData: dataSS.length,
      coreMgmt: mgmtSS.length,
      spineData: b.spineData.length,
      spineMgmt: b.spineMgmt.length,
      leafData: accessDataCount,
      leafMgmt: b.leafMgmt.length,
      borderLeaves: borderCount,
      azCounts,
      maasSummary: maasModel?.groupSummaries.get(p.id) ?? null,
      maasLens,
      rackHealthCounts,
      searchMatches: matchedGroupCounts.get(p.id) ?? 0,
    }];
  }));

  // ── Transparent per-pod hit targets (click-to-select + column hover) ──────
  if (onSelectPod) {
    root.append('g').attr('class', 'stack-hit-targets')
      .selectAll('rect')
      .data(sortedPods)
      .join('rect')
        .attr('x',        p => podCols.get(p.id).x0)
        .attr('y',        -ARM_HEIGHT)
        .attr('width',    p => podCols.get(p.id).x1 - podCols.get(p.id).x0)
        .attr('height',   ARM_HEIGHT * 2)
        .attr('data-pod', p => p.id)   // queried by index.html's renderConnector()
        .attr('fill',     'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, p) {
          applyOpacities(p.id);
          const summary = podSummaries.get(p.id);
          tooltipEl.innerHTML = buildStackTooltip(summary);
          tooltipEl.style.display = 'block';
          positionStackTooltip(tooltipEl, event);
        })
        .on('mousemove', function(event) {
          positionStackTooltip(tooltipEl, event);
        })
        .on('mouseleave', function() {
          applyOpacities(null);
          tooltipEl.style.display = 'none';
        })
        .on('click', (event, p) => {
          event.stopPropagation();
          onSelectPod(p.id);
        });
  }
}

// ── Stack tooltip helpers ─────────────────────────────────────────────────────

const STACK_TOOLTIP_ID = 'stack-tooltip-panel';
const OFFSET_PX = 12;

function getOrCreateStackTooltip() {
  let el = document.getElementById(STACK_TOOLTIP_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = STACK_TOOLTIP_ID;
    el.className = 'stack-tooltip-panel';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function positionStackTooltip(el, event) {
  const { clientX, clientY } = event;
  const rect = el.getBoundingClientRect();
  let left = clientX + OFFSET_PX;
  let top  = clientY + OFFSET_PX;
  if (left + rect.width  > window.innerWidth)  left = clientX - OFFSET_PX - rect.width;
  if (top  + rect.height > window.innerHeight) top  = clientY - OFFSET_PX - rect.height;
  if (left < 0) left = OFFSET_PX;
  if (top  < 0) top  = OFFSET_PX;
  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;
}

function esc(v) {
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildStackTooltip(s) {
  const {
    pod,
    groupLabel,
    ringNames,
    servers,
    racks,
    coreData,
    coreMgmt,
    spineData,
    spineMgmt,
    leafData,
    leafMgmt,
    borderLeaves,
    azCounts,
    maasSummary,
    maasLens,
    rackHealthCounts,
    searchMatches,
  } = s;
  const endpointLabel = ringNames.R6 || 'Server';
  const rackLabel = ringNames.R5 || 'Rack';
  const coreLabel = ringNames.R2 || 'Superspine';
  const fabricLabel = ringNames.R3 || 'Spine';
  const accessLabel = ringNames.R4 || 'Leaf';

  // Header: pod label + CIDR chip
  let html =
    `<div class="stk-header">` +
      `<span class="stk-label">${esc(pod.label)}</span>` +
      `${pod.metadata?.cidr ? `<span class="stk-cidr">${esc(pod.metadata.cidr)}</span>` : `<span class="stk-cidr">${esc(groupLabel)}</span>`}` +
    `</div>`;

  // Counts row
  const plural = (count, label) => `${count} ${label}${count === 1 ? '' : 's'}`;
  html += `<div class="stk-counts">${esc(plural(servers, endpointLabel))} &nbsp;·&nbsp; ${esc(plural(racks, rackLabel))}</div>`;
  if (searchMatches) {
    html += `<div class="stk-counts">Search: ${esc(searchMatches)} matching object${searchMatches === 1 ? '' : 's'}</div>`;
  }

  html += `<div class="stk-divider"></div>`;

  // Plane rows
  const dataLeafStr = leafData > 0
    ? `${leafData} ${accessLabel}${borderLeaves ? ` + ${borderLeaves} border` : ''}`
    : (borderLeaves ? `${borderLeaves} border ${accessLabel}` : '—');
  const mgmtLeafStr = leafMgmt > 0 ? `${leafMgmt} ${accessLabel}` : '—';

  html +=
    `<table class="stk-plane-table">` +
      `<tr><td class="stk-plane-chip stk-plane-data">Data</td>` +
        `<td>${coreData} ${esc(coreLabel)}, ${spineData} ${esc(fabricLabel)}, ${dataLeafStr}</td></tr>` +
      `<tr><td class="stk-plane-chip stk-plane-mgmt">Mgmt</td>` +
        `<td>${coreMgmt} ${esc(coreLabel)}, ${spineMgmt} ${esc(fabricLabel)}, ${mgmtLeafStr}</td></tr>` +
    `</table>`;

  // AZ breakdown
  if (azCounts.size > 0) {
    html += `<div class="stk-divider"></div>`;
    html += `<div class="stk-az-list">`;
    azCounts.forEach((count, az) => {
      const azIdx = stableAzIndex(az);
      html +=
        `<span class="stk-az-row">` +
          `<span class="stk-az-swatch" style="background:var(--az-${azIdx})"></span>` +
          `<span class="stk-az-name">${esc(az)}</span>` +
          `<span class="stk-az-count">${count} rack${count !== 1 ? 's' : ''}</span>` +
        `</span>`;
    });
    html += `</div>`;
  }

  if (maasSummary?.matched) {
    html += `<div class="stk-divider"></div>`;
    html += `<div class="stk-counts">MAAS: ${esc(maasSummary.matched)}/${esc(maasSummary.endpoints)} matched · ${esc(buildMaasStackSummary(maasSummary, maasLens, rackHealthCounts))}</div>`;
  }

  return html;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function buildMaasStackSummary(summary, lens, rackHealthCounts) {
  if (lens === 'cpu' || lens === 'memory' || lens === 'storage') {
    const values = summary.capacityValues[lens];
    if (values.length === 0) return `${lens} unavailable`;
    const middle = median(values);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return `${lens} median ${middle} · range ${minimum}–${maximum}`;
  }
  if (lens === 'tenancy') {
    const pools = [...summary.poolCounts.entries()]
      .sort(([firstName, firstCount], [secondName, secondCount]) =>
        secondCount - firstCount || firstName.localeCompare(secondName))
      .map(([pool, count]) => `${pool} ${count}`)
      .join(', ');
    return pools || 'tenancy unavailable';
  }
  const labels = {
    attention: 'failed',
    transition: 'transitioning',
    active: 'active',
    available: 'ready',
    inactive: 'inactive',
    unknown: 'unknown',
    unmatched: 'unmatched',
  };
  const order = ['attention', 'transition', 'active', 'available', 'inactive', 'unknown', 'unmatched'];
  return order
    .filter(group => rackHealthCounts.get(group))
    .map(group => `${rackHealthCounts.get(group)} ${labels[group]} rack${rackHealthCounts.get(group) === 1 ? '' : 's'}`)
    .join(' · ');
}

/** Deterministic AZ → palette index (mirrors layout.js getAZColor exactly). */
function stableAzIndex(azId) {
  let hash = 0;
  for (let i = 0; i < azId.length; i++) {
    hash = (hash * 31 + azId.charCodeAt(i)) >>> 0;
  }
  return hash % 4;
}
