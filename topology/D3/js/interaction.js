/**
 * interaction.js — Phase 4
 *
 * §8.3  Hover / focus — parental lineage
 *   Hovering a node arc illuminates its full ANCESTRAL LINEAGE up to the pod
 *   root: the hovered node + every ancestor node (following parent links toward
 *   lower ring depths) + every link whose both endpoints are in that set.
 *   All unrelated arcs and links are dimmed.  Connected links are stroked at
 *   full brand-colour strength.  Mouse leave restores resting state.
 *
 * §8.2  Plane toggles
 *   Three pill buttons control which link planes are visible.
 *
 * Ring depth order (root → leaves):
 *   R1 (Pod) = 0 → R3 (Spine) = 1 → R4 (Leaf) = 2 → R5 (Rack) = 3 → R6 (Server) = 4
 *
 * Exports: initInteraction(root, layoutNodes, links)
 */

import * as d3 from 'd3';
import { linkColorKey } from './render.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_OPACITY = 0.07;

/** Maps ring id → depth (0 = root/pod, 4 = server/leaf). */
const RING_DEPTH = { R1: 0, R3: 1, R4: 2, R5: 3, R6: 4 };

const RESTING_LINK_OPACITY = { data: 1, mgmt: 1, shared: 1, peer_adjacency: 1 };

const RESTING_LINK_STROKE = {
  data:           '#C1501F',
  mgmt:           '#9C3D72',
  shared:         '#8C8579',
  peer_adjacency: '#B68720',
};

const HOVER_LINK_STROKE = {
  data:           '#E95420',
  mgmt:           '#D98AB5',
  shared:         '#D8D1CA',
  peer_adjacency: '#EFB73E',
};

const RESTING_STROKE_WIDTH = 1;
const HOVER_STROKE_WIDTH   = 1.5;

// ── Public API ────────────────────────────────────────────────────────────────

export function initInteraction(root, layoutNodes, links) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));

  // Build node→link-key index, omitting pod→rack containment links (not drawn)
  const nodeLinksIdx = buildNodeLinksIndex(layoutNodes, links, nodeById);

  const visible = { data: true, mgmt: true, shared: true };

  root.selectAll('.node-arc')
    .style('cursor', 'pointer')
    .on('mouseenter.lineage', (event, d) =>
      onFocus(root, d, nodeLinksIdx, nodeById))
    .on('mouseleave.lineage', () => onBlur(root));

  wireToggles(root, visible);

  console.log('[topology] Phase 4 interaction initialised — lineage hover + plane toggles active');
}

// ── Hover handlers ────────────────────────────────────────────────────────────

function onFocus(root, hoveredNode, nodeLinksIdx, nodeById) {
  const { lineageNodeIds, lineageLinkKeys } =
    collectLineage(hoveredNode.id, nodeLinksIdx, nodeById);

  // Arcs: highlight lineage, dim the rest
  root.selectAll('.node-arc')
    .attr('opacity', d => lineageNodeIds.has(d.id) ? 1 : DIM_OPACITY);

  // Links: highlight lineage links; dim the rest
  root.selectAll('.link').each(function(d) {
    const sel = d3.select(this);
    if (sel.attr('display') === 'none') return;

    const key = `${d.source}→${d.target}`;

    if (lineageLinkKeys.has(key)) {
      sel.attr('stroke',       HOVER_LINK_STROKE[linkColorKey(d)]    ?? HOVER_LINK_STROKE.shared)
         .attr('opacity',      RESTING_LINK_OPACITY[linkColorKey(d)] ?? RESTING_LINK_OPACITY.shared)
         .attr('stroke-width', HOVER_STROKE_WIDTH)
         .raise();
    } else {
      sel.attr('opacity', DIM_OPACITY)
         .attr('stroke-width', RESTING_STROKE_WIDTH);
    }
  });
}

function onBlur(root) {
  root.selectAll('.node-arc').attr('opacity', 1);

  root.selectAll('.link').each(function(d) {
    const sel = d3.select(this);
    if (sel.attr('display') === 'none') return;
    sel.attr('stroke',       RESTING_LINK_STROKE[linkColorKey(d)]    ?? RESTING_LINK_STROKE.shared)
       .attr('opacity',      RESTING_LINK_OPACITY[linkColorKey(d)]   ?? RESTING_LINK_OPACITY.shared)
       .attr('stroke-width', RESTING_STROKE_WIDTH);
  });
}

// ── Lineage traversal ─────────────────────────────────────────────────────────

/**
 * collectLineage(startId, nodeLinksIdx, nodeById)
 *
 * BFS upward through the ring hierarchy from `startId`, collecting:
 *   lineageNodeIds — the hovered node + every ancestor (lower ring depth)
 *   lineageLinkKeys — every link key whose both endpoints are in lineageNodeIds
 *
 * Because the BFS only follows edges toward lower ring depths, the traversal
 * never crosses into sibling branches (e.g. hovering rack-1 won't pull in
 * leaf-data-3 which serves a different rack group).  It DOES include all
 * ancestors of every ancestor — so for a dual-leaf rack, both leaves and
 * all spines connected to those leaves are included.
 */
function collectLineage(startId, nodeLinksIdx, nodeById) {
  const lineageNodeIds = new Set([startId]);
  const queue    = [startId];
  const visited  = new Set([startId]);

  // Pass 1: BFS upward — add ancestors only
  while (queue.length > 0) {
    const nodeId = queue.shift();
    const node   = nodeById.get(nodeId);
    if (!node) continue;
    const depth = RING_DEPTH[node.ring] ?? 99;

    for (const key of (nodeLinksIdx.get(nodeId) ?? [])) {
      const [src, tgt] = key.split('→');
      const otherId = src === nodeId ? tgt : src;
      const other   = nodeById.get(otherId);
      if (!other) continue;

      const otherDepth = RING_DEPTH[other.ring] ?? 99;
      // Only traverse toward the root (lower depth)
      if (otherDepth < depth && !visited.has(otherId)) {
        visited.add(otherId);
        lineageNodeIds.add(otherId);
        queue.push(otherId);
      }
    }
  }

  // Pass 2: collect every link whose both endpoints landed in lineageNodeIds
  const lineageLinkKeys = new Set();
  lineageNodeIds.forEach(nodeId => {
    for (const key of (nodeLinksIdx.get(nodeId) ?? [])) {
      const [src, tgt] = key.split('→');
      if (lineageNodeIds.has(src) && lineageNodeIds.has(tgt)) {
        lineageLinkKeys.add(key);
      }
    }
  });

  return { lineageNodeIds, lineageLinkKeys };
}

// ── Plane toggles ─────────────────────────────────────────────────────────────

function wireToggles(root, visible) {
  d3.selectAll('.toggle-btn').on('click', function() {
    const plane = d3.select(this).attr('data-plane');
    if (!plane) return;

    visible[plane] = !visible[plane];
    const nowOn = visible[plane];

    d3.select(this).classed('active', nowOn);

    root.selectAll(`.link[data-plane="${plane}"]`)
      .attr('display', nowOn ? null : 'none');
  });
}

// ── Node → link-key index ─────────────────────────────────────────────────────

/**
 * buildNodeLinksIndex — returns a Map<nodeId, linkKey[]>.
 * Pod→rack containment links (R1↔R5) are excluded because they are not drawn.
 */
function buildNodeLinksIndex(layoutNodes, links, nodeById) {
  const index = new Map(layoutNodes.map(n => [n.id, []]));

  links.forEach(link => {
    const s = nodeById.get(link.source);
    const t = nodeById.get(link.target);
    if (!s || !t) return;
    // Skip pod→rack containment links (not drawn)
    if ((s.ring === 'R1' && t.ring === 'R5') ||
        (s.ring === 'R5' && t.ring === 'R1')) return;

    const key = `${link.source}→${link.target}`;
    index.get(link.source)?.push(key);
    index.get(link.target)?.push(key);
  });

  return index;
}
