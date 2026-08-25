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
 * Ring depth order (root → leaves):
 *   R1 (Pod) = 0 → R2 (Superspine) = 1 → R3 (Spine) = 2 → R4 (Leaf) = 3 → R5 (Rack) = 4 → R6 (Server) = 5
 *
 * R2 is only populated in Option D; for all other options R2 nodes are absent
 * so RING_DEPTH[R2] is never evaluated.  It must be present here so that BFS
 * correctly treats super-spines as ancestors of spines (not the reverse).
 *
 * Exports:
 *   initInteraction(root, layoutNodes, links)   — Disc View entry point:
 *   lineage hover and node selection.
 * initLineageHover(root, layoutNodes, links)  — lineage hover only.
 */

import * as d3 from 'd3';
import { linkColorKey, LINK_COLORS, LINK_HOVER_COLORS } from './render.js';
import { buildNodeLinksIndex, collectLineage } from './lineage.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_OPACITY = 0.07;

const RESTING_LINK_OPACITY = { data: 1, mgmt: 1, shared: 1, peer_adjacency: 1 };

// Resting/hover stroke colours are theme-aware CSS var() references, sourced
// from render.js's LINK_COLORS/LINK_HOVER_COLORS (§11.6) rather than
// duplicated here — a single source of truth per theme in style.css.
const RESTING_LINK_STROKE = LINK_COLORS;
const HOVER_LINK_STROKE   = LINK_HOVER_COLORS;

const RESTING_STROKE_WIDTH = 1;
const HOVER_STROKE_WIDTH   = 1.5;

// ── Public API ────────────────────────────────────────────────────────────────

export function initInteraction(root, layoutNodes, links, options = {}) {
  const cleanupLineage = initLineageHover(root, layoutNodes, links, {
    onRestore: options.onRestore,
  });

  const teardownSelection = wireSelection(root, options);

  console.log('[topology] Phase 4 interaction initialised — lineage hover active');

  // Return a cleanup function for option switching so event listeners do not accumulate.
  return function cleanup() {
    cleanupLineage();
    if (teardownSelection) teardownSelection();
  };
}

/**
 * initLineageHover(root, layoutNodes, links) — §8.3 hover/focus lineage
 * highlighting only. This is what initInteraction() uses internally for the
 * Disc View and what Stack View (§12.11) can call without adding selection
 * handlers to its own SVG.
 *
 * Returns a cleanup function that removes just the lineage listeners.
 */
export function initLineageHover(root, layoutNodes, links, { onRestore } = {}) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));

  // Build node→link-key index, omitting pod→rack containment links (not drawn)
  const nodeLinksIdx = buildNodeLinksIndex(layoutNodes, links, nodeById);

  root.selectAll('.node-arc')
    .style('cursor', 'pointer')
    .on('mouseenter.lineage', (event, d) =>
      onFocus(root, d, nodeLinksIdx, nodeById))
    .on('mouseleave.lineage', () => onBlur(root, onRestore));

  return function cleanup() {
    root.selectAll('.node-arc').on('mouseenter.lineage', null).on('mouseleave.lineage', null);
  };
}

function wireSelection(root, { onSelectNode } = {}) {
  const selectNode = (event, node) => {
    event.stopPropagation();
    onSelectNode?.(node);
  };
  root.selectAll('.node-arc')
    .on('click.selection', selectNode)
    .on('keydown.selection', (event, node) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectNode(event, node);
    });
  return () => {
    root.selectAll('.node-arc').on('click.selection', null).on('keydown.selection', null);
  };
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

function onBlur(root, onRestore) {
  if (onRestore) {
    onRestore();
    return;
  }
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
export function applyInvestigationHighlight(root, layoutNodes, links, {
  selection = null,
  contextNodeIds = new Set(),
  matchedNodeIds = new Set(),
  active = false,
  evidenceMarkers = false,
  lod = 'detail',
} = {}) {
  const selectedNodeId = selection?.type === 'node' ? selection.id : null;
  const selectedLinkId = selection?.type === 'link' ? selection.id : null;
  const selectedLink = selectedLinkId
    ? links.find(link => (link.id || `${link.source}→${link.target}`) === selectedLinkId)
    : null;
  const focusedNodes = new Set(contextNodeIds);
  const nodeById = new Map(layoutNodes.map(node => [node.id, node]));
  const nodeLinksIdx = buildNodeLinksIndex(layoutNodes, links, nodeById);
  const addLineage = nodeId => {
    const { lineageNodeIds } = collectLineage(nodeId, nodeLinksIdx, nodeById);
    lineageNodeIds.forEach(id => focusedNodes.add(id));
  };
  if (selectedLink) {
    addLineage(selectedLink.source);
    addLineage(selectedLink.target);
  }
  if (selectedNodeId) {
    addLineage(selectedNodeId);
  }
  const hasFocus = active || Boolean(selectedNodeId || selectedLinkId);

  root.classed('lod-overview', lod === 'overview')
    .classed('lod-fabric', lod === 'fabric')
    .classed('lod-detail', lod === 'detail')
    .classed('evidence-markers', evidenceMarkers);

  root.selectAll('.node-arc')
    .classed('selected', node => node.id === selectedNodeId)
    .classed('matched', node => matchedNodeIds.has(node.id))
    .classed('unresolved', node => Boolean(node.metadata?.sourceQuality?.unresolved))
    .classed('inferred', node => node.metadata?.provenance === 'inferred')
    .classed('synthetic', node => node.metadata?.provenance === 'synthetic')
    .attr('opacity', node => !hasFocus || focusedNodes.has(node.id) ? 1 : DIM_OPACITY);

  root.selectAll('.link-group')
    .classed('selected', link => (link.id || `${link.source}→${link.target}`) === selectedLinkId)
    .classed('matched', link => selectedLinkId
      ? (link.id || `${link.source}→${link.target}`) === selectedLinkId
      : matchedNodeIds.has(link.source) || matchedNodeIds.has(link.target))
    .attr('opacity', link => !hasFocus ||
      (focusedNodes.has(link.source) && focusedNodes.has(link.target)) ? 1 : DIM_OPACITY);

  root.selectAll('.link-group .link')
    .attr('stroke-width', link => evidenceMarkers
      ? Math.min(3, 1 + Math.log2((link.metadata?.observationCount || 1) + 1) * 0.45)
      : 1);
}

// ── Node → link-key index ─────────────────────────────────────────────────────

/**
 * buildNodeLinksIndex — returns a Map<nodeId, linkKey[]>.
 * Pod→rack containment links (R1↔R5) are excluded because they are not drawn.
 */
