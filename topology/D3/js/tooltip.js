/**
 * tooltip.js — Phase 7
 *
 * §8.6 Tooltip panel (hover detail) — a structured, styled HTML overlay that
 * replaces the plain browser-native tooltip previously attached to node arcs
 * in render.js. Fires from the same hover target as the lineage highlight
 * (interaction.js) via a namespaced `.tooltip` event, so both effects run
 * independently without clobbering each other's listeners.
 *
 * Sections rendered, top to bottom (empty sections omitted entirely, §8.6):
 *   1. Header        — swatch + label + ring/plane badge
 *   2. Meta row       — weight + arc span
 *   3. MAAS Control Plane (§7.7) — only if rack_controller_ids.length > 0
 *   4. Availability Zone (§7.8)  — only if availability_zone !== "n/a"
 *   5. Categorization footer — trust_tier / failure_domain_role
 *   6. Metadata description (italic, muted)
 *
 * Exports: initTooltip(root, layoutNodes)
 */

import { getNodeFill } from './render.js';
import { getAZColor } from './layout.js';

const RING_NAMES = { R1: 'Pod', R3: 'Spine', R4: 'Leaf', R5: 'Rack', R6: 'Server' };
const PANEL_ID = 'tooltip-panel';
const OFFSET_PX = 12;

export function initTooltip(root, layoutNodes) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));
  const rackAzById = new Map(
    layoutNodes.filter(n => n.ring === 'R5').map(n => [n.id, n.availability_zone])
  );

  const panel = getOrCreatePanel();

  root.selectAll('.node-arc')
    .on('mouseenter.tooltip', (event, d) => {
      panel.innerHTML = buildTooltipContent(d, rackAzById);
      panel.style.display = 'block';
      positionPanel(panel, event);
    })
    .on('mousemove.tooltip', (event) => {
      positionPanel(panel, event);
    })
    .on('mouseleave.tooltip', () => {
      panel.style.display = 'none';
    });

  console.log('[topology] Phase 7 tooltip panel initialised — §8.6');
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function getOrCreatePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'tooltip-panel';
    panel.style.display = 'none';
    document.body.appendChild(panel);
  }
  return panel;
}

/**
 * positionPanel — anchors the panel near the cursor, flipping to the
 * opposite side when it would overflow the viewport edge (§8.6).
 */
function positionPanel(panel, event) {
  const { clientX, clientY } = event;
  const rect = panel.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = clientX + OFFSET_PX;
  let top  = clientY + OFFSET_PX;

  if (left + rect.width > viewportW)  left = clientX - OFFSET_PX - rect.width;
  if (top + rect.height > viewportH)  top  = clientY - OFFSET_PX - rect.height;
  if (left < 0) left = OFFSET_PX;
  if (top < 0)  top  = OFFSET_PX;

  panel.style.left = `${left}px`;
  panel.style.top  = `${top}px`;
}

// ── Content builders ──────────────────────────────────────────────────────────

function buildTooltipContent(d, rackAzById) {
  const sections = [];

  sections.push(buildHeader(d));
  sections.push(buildMetaRow(d));

  const controlPlane = buildControlPlaneSection(d);
  if (controlPlane) sections.push(controlPlane);

  const azSection = buildAZSection(d, rackAzById);
  if (azSection) sections.push(azSection);

  const footer = buildFooter(d);
  if (footer) sections.push(footer);

  const desc = buildDescription(d);
  if (desc) sections.push(desc);

  return sections.join('<div class="tooltip-divider"></div>');
}

function buildHeader(d) {
  const fill = getNodeFill(d);
  // §8.6 style table — "Monospace fields: Ubuntu Mono ... for rack controller
  // IDs and any rack/server label", consistent with §11.2's R5/R6 arc-label
  // treatment. Apply the mono class to the title only for R5/R6 nodes.
  const monoClass = (d.ring === 'R5' || d.ring === 'R6') ? ' is-mono' : '';
  return (
    `<div class="tooltip-header">` +
      `<span class="tooltip-swatch" style="background:${fill}"></span>` +
      `<span class="tooltip-title${monoClass}">${escapeHtml(d.label)}</span>` +
      `<span class="tooltip-ring-badge">${d.ring} · ${escapeHtml(ringTypeLabel(d))}</span>` +
    `</div>`
  );
}

function buildMetaRow(d) {
  const spanDeg = ((d.endAngle - d.startAngle) * 180 / Math.PI).toFixed(1);
  return `<div class="tooltip-meta">Weight: ${d.weight} &nbsp;·&nbsp; Arc span: ${spanDeg}°</div>`;
}

/** §7.7 — MAAS control-plane section, orange-accented, only if populated. */
function buildControlPlaneSection(d) {
  if (!d.rack_controller_ids || d.rack_controller_ids.length === 0) return null;
  return (
    `<div class="tooltip-section tooltip-section--control">` +
      `<div class="tooltip-section-label">MAAS Control Plane</div>` +
      `<div class="tooltip-mono">${d.rack_controller_ids.map(escapeHtml).join(', ')}</div>` +
    `</div>`
  );
}

/** §7.8 — Availability Zone section, AZ-accent-colored, only if populated. */
function buildAZSection(d, rackAzById) {
  if (!d.availability_zone || d.availability_zone === 'n/a') return null;
  const azColor = getAZColor(d.availability_zone) ?? '#9C948C';

  let azLine = escapeHtml(d.availability_zone);
  if (d.ring === 'R6' && d.metadata?.rack) {
    const rackAz = rackAzById.get(d.metadata.rack);
    if (rackAz && rackAz !== d.availability_zone) {
      azLine += ` <span class="tooltip-az-rack">(rack: ${escapeHtml(rackAz)})</span>`;
    }
  }

  return (
    `<div class="tooltip-section" style="border-left-color:${azColor}">` +
      `<div class="tooltip-section-label">Availability Zone</div>` +
      `<div class="tooltip-az"><span class="tooltip-swatch" style="background:${azColor}"></span>${azLine}</div>` +
    `</div>`
  );
}

/**
 * §7.2/§7.3 — trust tier + failure domain, textual restatement of the arc
 * styling PLUS a small colour/pattern swatch reusing the same border-style/
 * severity encoding defined in those sections (spec §8.6 point 5), so the
 * footer isn't purely textual — it's an accessible restatement of a visual
 * encoding, not a brand-new one:
 *   trust_tier:            "operator" = solid-border swatch,
 *                           "tenant" = dashed-border swatch,
 *                           "workload" = hatched-fill swatch (§7.2)
 *   failure_domain_role:   "spof" = solid warm-red dot,
 *                           "redundant" = solid muted-green dot (§7.3)
 */
function buildFooter(d) {
  const bits = [];
  if (d.trust_tier && d.trust_tier !== 'n/a') {
    bits.push(
      `<span class="trust-swatch trust-${d.trust_tier}"></span>` +
      `Trust: ${escapeHtml(d.trust_tier)}`
    );
  }
  if (d.failure_domain_role && d.failure_domain_role !== 'n/a') {
    bits.push(
      `<span class="failure-swatch failure-${d.failure_domain_role}"></span>` +
      `Failure domain: ${escapeHtml(d.failure_domain_role)}`
    );
  }
  if (bits.length === 0) return null;
  return `<div class="tooltip-footer">${bits.join(' &nbsp;&nbsp; ')}</div>`;
}

function buildDescription(d) {
  const text = d.metadata?.description || d.metadata?.note;
  if (!text) return null;
  return `<div class="tooltip-desc">${escapeHtml(text)}</div>`;
}

/** Human-readable ring/plane/role label, e.g. "Data Leaf", "Border Leaf", "Rack". */
function ringTypeLabel(d) {
  const base = RING_NAMES[d.ring] ?? d.ring;
  if (d.ring === 'R4' && d.leaf_role === 'border') return 'Border Leaf';
  if ((d.ring === 'R3' || d.ring === 'R4') && d.plane && d.plane !== 'shared' && d.plane !== 'n/a') {
    const planeLabel = d.plane === 'data' ? 'Data' : d.plane === 'mgmt' ? 'Mgmt' : d.plane;
    return `${planeLabel} ${base}`;
  }
  return base;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


