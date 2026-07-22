/**
 * interaction.js — Phase 4
 *
 * Implements two spec behaviours:
 *
 *   §8.3  Hover / focus
 *     Hovering a node arc:
 *       (a) Highlights all directly connected links in currently-visible planes.
 *       (b) De-bundles those links to full individual-strand resolution by
 *           swapping their bundled path (β=0.7) for a plain β=0 Bezier path.
 *       (c) Dims all unrelated arcs and links.
 *     Mouse leave restores resting state (resting opacities + re-bundled paths).
 *
 *   §8.2  Plane toggles
 *     Three flat pill buttons — Data / Management / Containment — control which
 *     link planes are visible.  Toggling never affects arc geometry; only the
 *     `display` attribute on matching link paths changes.
 *     Default: all three planes on (§8.2 specifies Data + Mgmt on by default;
 *     Containment is also on here since its grey skeleton links are low-weight
 *     and add structural context at no visual cost).
 *
 *   §8.4  Label degradation — skipped.
 *     Unnecessary at Option C scale (action plan §4 Phase 4 note).
 *
 * Exports: initInteraction(root, layoutNodes, links)
 */

import * as d3 from 'd3';
import { computeBundledPaths } from './bundling.js';
import { CONFIG } from './layout.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Opacity for elements that are unrelated to the currently-focused node. */
const DIM_OPACITY = 0.07;

/**
 * Resting link opacities — mirrors LINK_OPACITY in render.js (Phase 5: all 1).
 * Tint colour carries the visual weight; no CSS opacity fade (action plan §6.1).
 */
const RESTING_LINK_OPACITY = { data: 1, mgmt: 1, shared: 1 };

/**
 * Resting stroke colours — matches LINK_COLORS in render.js (67% tints).
 * Kept as a local duplicate to avoid coupling interaction.js to render.js.
 */
const RESTING_LINK_STROKE = {
  data:   '#F08D6A',   // Ubuntu Orange at 67% tint
  mgmt:   '#A4708C',   // Aubergine at 67% tint
  shared: '#D8D1CA',   // Canonical warm grey skeleton
};

/**
 * Hover/focus stroke colours — full-strength brand colours (action plan §6.1).
 * Applied to connected links while a node is focused, then restored on blur.
 */
const HOVER_LINK_STROKE = {
  data:   '#E95420',   // Ubuntu Orange full strength
  mgmt:   '#772953',   // Aubergine full strength
  shared: '#AEA9A5',   // Canonical warm grey mid
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * initInteraction(root, layoutNodes, links)
 *
 * Must be called AFTER init(), drawLinks(), and applyBundling() have
 * rendered the SVG — all `.node-arc` and `.link` elements must exist.
 *
 * @param {d3.Selection} root        — the `.topology-root` <g> element
 * @param {Array}        layoutNodes — output of computeLayout()
 * @param {Array}        links       — raw link array from data.js
 */
export function initInteraction(root, layoutNodes, links) {
  // ── Pre-compute both path maps ─────────────────────────────────────────────
  // bundledPaths (β = CONFIG.bundleStrength): used to RESTORE after hover ends.
  // plainPaths   (β = 0):                    used to DE-BUNDLE on hover (§8.3b).
  const bundledPaths = computeBundledPaths(layoutNodes, links, CONFIG.bundleStrength);
  const plainPaths   = computeBundledPaths(layoutNodes, links, 0);

  // ── Per-node link index ────────────────────────────────────────────────────
  // Maps each node id to the set of link-keys (source→target) that touch it.
  const nodeLinksIdx = buildNodeLinksIndex(layoutNodes, links);

  // ── Shared plane-visibility state (mutated by wireToggles click handlers) ────
  // The DOM is the source of truth for which planes are visible (display attr on
  // link paths).  `visible` tracks the same state as a JS object so wireToggles
  // can compute the new state without re-reading the DOM.
  const visible = { data: true, mgmt: true, shared: true };

  // ── §8.3 Hover / focus ────────────────────────────────────────────────────
  root.selectAll('.node-arc')
    .style('cursor', 'pointer')
    .on('mouseenter', (event, d) => onFocus(root, d, nodeLinksIdx, plainPaths))
    .on('mouseleave', ()          => onBlur (root, bundledPaths));

  // ── §8.2 Plane toggles ────────────────────────────────────────────────────
  wireToggles(root, visible);

  console.log('[topology] Phase 4 interaction initialised — hover + plane toggles active');
}

// ── Hover handlers ────────────────────────────────────────────────────────────

/**
 * onFocus — called on mouseenter of any node arc.
 *
 * Dims all unrelated arcs and links; highlights connected links and de-bundles
 * their paths to plain Bezier curves for individual-strand readability (§8.3b).
 * Connected links are also raised to the top of the links layer so they are
 * not obscured by dimmed links.
 */
function onFocus(root, hoveredNode, nodeLinksIdx, plainPaths) {
  const hid  = hoveredNode.id;
  const keys = new Set(nodeLinksIdx.get(hid) ?? []);

  // Arcs: dim all except the hovered node
  root.selectAll('.node-arc')
    .attr('opacity', d => (d.id === hid ? 1 : DIM_OPACITY));

  // Links: dim unrelated ones; highlight + de-bundle connected ones
  root.selectAll('.link').each(function(d) {
    const sel = d3.select(this);

    // Links hidden by plane toggle must stay hidden — don't alter their state
    if (sel.attr('display') === 'none') return;

    const key = `${d.source}→${d.target}`;

    if (keys.has(key)) {
      // Connected: swap to plain (de-bundled) path, apply full-strength hover
      // stroke colour (action plan §6.1 — full-strength on hover/focus),
      // restore resting opacity, bring element to front within the links layer.
      const plain = plainPaths.get(key);
      if (plain) sel.attr('d', plain);
      sel.attr('stroke',  HOVER_LINK_STROKE[d.plane]  ?? HOVER_LINK_STROKE.shared)
         .attr('opacity', RESTING_LINK_OPACITY[d.plane] ?? RESTING_LINK_OPACITY.shared)
         .raise();
    } else {
      sel.attr('opacity', DIM_OPACITY);
    }
  });
}

/**
 * onBlur — called on mouseleave from any node arc.
 *
 * Restores all arcs and visible links to their resting state, re-applying
 * bundled paths to links that were de-bundled during the hover.
 */
function onBlur(root, bundledPaths) {
  // Arcs: full resting opacity
  root.selectAll('.node-arc').attr('opacity', 1);

  // Links: resting opacity + re-bundle path
  // Links hidden by plane toggle are skipped — they stay hidden.
  root.selectAll('.link').each(function(d) {
    const sel = d3.select(this);
    if (sel.attr('display') === 'none') return;

    const path = bundledPaths.get(`${d.source}→${d.target}`);
    if (path) sel.attr('d', path);
    sel.attr('stroke',  RESTING_LINK_STROKE[d.plane]  ?? RESTING_LINK_STROKE.shared)
       .attr('opacity', RESTING_LINK_OPACITY[d.plane] ?? RESTING_LINK_OPACITY.shared);
  });
}

// ── Plane toggles ─────────────────────────────────────────────────────────────

/**
 * wireToggles — attaches click handlers to elements with class `toggle-btn`
 * and a `data-plane` attribute in the host page.
 *
 * Each click:
 *   1. Flips `visible[plane]`.
 *   2. Toggles the `active` CSS class on the button.
 *   3. Sets `display: none` / removes `display` on all `.link[data-plane=X]`.
 *
 * Arc geometry is never modified (§8.2: "only link visibility changes").
 */
function wireToggles(root, visible) {
  d3.selectAll('.toggle-btn').on('click', function() {
    const plane = d3.select(this).attr('data-plane');
    if (!plane) return;

    visible[plane] = !visible[plane];
    const nowOn = visible[plane];

    // Update button active class
    d3.select(this).classed('active', nowOn);

    // Show / hide link paths for this plane
    root.selectAll(`.link[data-plane="${plane}"]`)
      .attr('display', nowOn ? null : 'none');
  });
}

// ── Node → link-key index ─────────────────────────────────────────────────────

/**
 * buildNodeLinksIndex — returns a Map<nodeId, linkKey[]>.
 *
 * For every drawable link, both its source and target node receive the link's
 * key in their respective arrays.  This is the lookup used by onFocus to
 * determine which links to highlight and de-bundle.
 */
function buildNodeLinksIndex(layoutNodes, links) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));
  const index    = new Map(layoutNodes.map(n => [n.id, []]));

  links.forEach(link => {
    if (!nodeById.has(link.source) || !nodeById.has(link.target)) return;
    const key = `${link.source}→${link.target}`;
    index.get(link.source).push(key);
    index.get(link.target).push(key);
  });

  return index;
}



