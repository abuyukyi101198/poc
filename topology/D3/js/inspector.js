function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  if (value == null || value === '' || value === false) return '';
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function section(title, body) {
  return body ? `<section class="inspector-section"><h3>${escapeHtml(title)}</h3>${body}</section>` : '';
}

function provenanceLabel(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : 'Reference';
}

function maasRows(node) {
  const maas = node.metadata?.maas;
  if (!maas) {
    return node.ring === 'R6' ? row('Match', 'No matched MAAS machine') : '';
  }
  return [
    row('Match', 'Matched MAAS machine'),
    row('Hostname', maas.hostname),
    row('System ID', maas.systemId),
    row('Availability zone', maas.zone?.name),
    row('Resource pool', maas.pool?.name),
    row('Lifecycle status', maas.status),
    row('Power state', maas.powerState),
    row('Architecture', maas.architecture),
    row('CPU count', maas.cpuCount),
    row('Memory (MAAS reported)', maas.memory),
    row('Storage (MAAS reported)', maas.storage),
  ].join('');
}

function nodeButton(node) {
  return `<button type="button" class="inspector-link" data-node-id="${encodeURIComponent(node.id)}">${escapeHtml(node.label)}</button>`;
}

function linkButton(link, label) {
  const id = link.id || `${link.source}→${link.target}`;
  return `<button type="button" class="inspector-link" data-link-id="${encodeURIComponent(id)}">${escapeHtml(label)}</button>`;
}

function buildNode(node, links, nodeById, ringNames) {
  const metadata = node.metadata || {};
  const inventory = metadata.inventory || {};
  const interfaces = metadata.interfaceSummary || {};
  const resiliency = metadata.resiliency;
  const quality = metadata.sourceQuality || {};
  const connected = links.filter(link => link.source === node.id || link.target === node.id);
  const topology = [
    row('Layer', ringNames[node.ring] || node.ring),
    row('Plane', node.plane),
    row('Provenance', provenanceLabel(metadata.provenance)),
    row('Inferred tier', metadata.inferredTier),
    row('Endpoint distance', metadata.endpointDistance),
    row('Rack candidate', metadata.rackCandidate),
    row('Frame', metadata.frame),
    row('Stack group', metadata.stackGroup),
  ].join('');
  const inventoryRows = [
    row('Vendor', inventory.vendor),
    row('Model', inventory.model),
    row('OS', inventory.os),
    row('Capabilities', inventory.capabilities?.join(', ')),
    row('Routing capable', inventory.routingCapable ? 'Yes' : null),
    row('Management IPs', inventory.managementIpCount != null ? `${inventory.managementIpCount} recorded` : null),
  ].join('');
  const evidenceRows = [
    row('Physical interfaces', interfaces.physical),
    row('Connected interfaces', interfaces.connected),
    row('Access / trunk', interfaces.accessPorts != null ? `${interfaces.accessPorts} / ${interfaces.trunkPorts}` : null),
    row('Connected but unused', interfaces.connectedUnusedPorts),
    row('Bond mode', resiliency?.mode?.join(', ')),
    row('Bond members', resiliency?.memberCount),
    row('Observed access switches', resiliency?.observedAccessSwitchCount),
    row('Observed rack candidates', resiliency?.observedRackCandidateCount),
    row('Resolution', metadata.resolution?.status),
    row('Descriptions', metadata.resolution?.interfaceDescriptions?.join(', ')),
    row('Timestamp artifact', quality.modelTimestampArtifact || quality.descriptionTimestampArtifact ? 'Present' : null),
  ].join('');
  const maas = maasRows(node);
  const connections = connected.slice(0, 30).map(link => {
    const other = nodeById.get(link.source === node.id ? link.target : link.source);
    const detail = `${link.type} · ${link.metadata?.observationCount ?? 0} observations`;
    return `<li>${other ? nodeButton(other) : escapeHtml(link.source === node.id ? link.target : link.source)}<span>${escapeHtml(detail)}</span>${linkButton(link, 'Inspect link')}</li>`;
  }).join('');

  return `
    <div class="inspector-header">
      <div><h2>${escapeHtml(node.label)}</h2><p>${escapeHtml(ringNames[node.ring] || node.ring)} · ${escapeHtml(node.plane)}</p></div>
      <span class="provenance-badge provenance-${escapeHtml(metadata.provenance || 'reference')}">${escapeHtml(provenanceLabel(metadata.provenance))}</span>
    </div>
    ${section('Topology', `<table>${topology}</table>`)}
    ${section('Inventory', `<table>${inventoryRows}</table>`)}
    ${section('MAAS', maas ? `<table>${maas}</table>` : '')}
    ${section('Evidence', `<table>${evidenceRows}</table>`)}
    ${section(`Connections (${connected.length})`, connections ? `<ul class="inspector-connections">${connections}</ul>` : '<p class="inspector-empty">No rendered connections.</p>')}
  `;
}

function buildLink(link, nodeById) {
  const metadata = link.metadata || {};
  const vlan = metadata.vlanEvidence || {};
  const ports = metadata.portDetails || metadata.ports || [];
  const source = nodeById.get(link.source);
  const target = nodeById.get(link.target);
  const details = [
    row('Type', link.type),
    row('Plane', link.plane),
    row('Plane evidence', metadata.planeEvidence),
    row('Provenance', provenanceLabel(metadata.provenance)),
    row('Confirmation', metadata.confirmedBy),
    row('Observations', metadata.observationCount),
    row('Speed', metadata.speedsMbps?.map(speed => speed >= 1000 ? `${speed / 1000}G` : `${speed}M`).join(', ')),
    row('VLANs', vlan.names?.join(', ') || metadata.vlanIds?.join(', ')),
    row('Port modes', metadata.portEvidence?.modes?.join(', ')),
    row('Connected but unused', metadata.portEvidence?.connectedUnusedPortCount),
  ].join('');
  const portRows = ports.slice(0, 30).map(port =>
    `<tr><td>${escapeHtml(port.localPort || '—')}</td><td>${escapeHtml(port.remotePort || '—')}</td><td>${escapeHtml(port.mode || '—')}</td><td>${escapeHtml(port.status || '—')}</td></tr>`
  ).join('');
  return `
    <div class="inspector-header">
      <div><h2>Link</h2><p>${escapeHtml(link.type)} · ${escapeHtml(link.plane)}</p></div>
      <span class="provenance-badge provenance-${escapeHtml(metadata.provenance || 'reference')}">${escapeHtml(provenanceLabel(metadata.provenance))}</span>
    </div>
    ${section('Endpoints', `<div class="inspector-endpoints">${source ? nodeButton(source) : escapeHtml(link.source)}<span>→</span>${target ? nodeButton(target) : escapeHtml(link.target)}</div>`)}
    ${section('Evidence', `<table>${details}</table>`)}
    ${section(`Participating ports (${ports.length})`, ports.length
      ? `<table class="inspector-ports"><thead><tr><th>Local</th><th>Remote</th><th>Mode</th><th>Status</th></tr></thead><tbody>${portRows}</tbody></table>`
      : '<p class="inspector-empty">No observed port details.</p>')}
  `;
}

function buildSearchResults(query, resultIds, nodeById, ringNames) {
  const results = resultIds
    .map(id => nodeById.get(id))
    .filter(Boolean)
    .sort((first, second) => first.label.localeCompare(second.label, undefined, {
      numeric: true,
      sensitivity: 'base',
    }));
  const items = results.slice(0, 200).map(node =>
    `<li>${nodeButton(node)}<span>${escapeHtml(ringNames[node.ring] || node.ring)}</span></li>`
  ).join('');
  return `
    <div class="inspector-header">
      <div><h2>Search results</h2><p>${escapeHtml(query)}</p></div>
    </div>
    ${section(`Matches (${results.length})`, items
      ? `<ul class="inspector-connections">${items}</ul>`
      : '<p class="inspector-empty">No matching topology nodes.</p>')}
  `;
}

function panelActions(canGoBack) {
  return `
    <div class="inspector-actions">
      ${canGoBack ? '<button type="button" class="inspector-back" data-action="back">Back</button>' : '<span></span>'}
      <button type="button" class="inspector-close" data-action="close" aria-label="Close inspector">×</button>
    </div>
  `;
}

export function initInspector({
  panelSelector = '#inspector-panel',
  onSelectNode,
  onSelectLink,
  onClose,
  onBack,
} = {}) {
  const panel = document.querySelector(panelSelector);
  if (!panel) return { render() {} };

  panel.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.action === 'close') {
      onClose?.();
    } else if (target.dataset.action === 'back') {
      onBack?.();
    } else if (target.dataset.nodeId) {
      onSelectNode?.(decodeURIComponent(target.dataset.nodeId));
    } else if (target.dataset.linkId) {
      onSelectLink?.(decodeURIComponent(target.dataset.linkId));
    }
  });

  return {
    render({
      selection,
      nodes,
      links,
      ringNames = {},
      searchQuery = '',
      searchResultIds = [],
      canGoBack = false,
    }) {
      const nodeById = new Map(nodes.map(node => [node.id, node]));
      const linkById = new Map(links.map(link => [link.id || `${link.source}→${link.target}`, link]));
      if (!selection && !searchQuery.trim()) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
      }
      if (!selection) {
        panel.hidden = false;
        panel.innerHTML = `${panelActions(false)}${buildSearchResults(searchQuery, searchResultIds, nodeById, ringNames)}`;
        return;
      }
      const selected = selection.type === 'node'
        ? nodeById.get(selection.id)
        : linkById.get(selection.id);
      if (!selected) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
      }
      const content = selection.type === 'node'
        ? buildNode(selected, links, nodeById, ringNames)
        : buildLink(selected, nodeById);
      panel.hidden = false;
      panel.innerHTML = `${panelActions(canGoBack)}${content}`;
    },
  };
}
