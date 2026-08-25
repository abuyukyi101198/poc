const CONFIRMATION_PRIORITY = [
  'machine-and-switch',
  'switch-to-switch',
  'switch',
  'maas',
];

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function compareRawNodes(a, b) {
  return collator.compare(a.hostname || a.id, b.hostname || b.id) ||
    a.id.localeCompare(b.id);
}

function labelFor(node) {
  return node.hostname || node.id;
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isTimestampArtifact(value) {
  return /^### Timestamp:/i.test(value || '');
}

function interfaceSummary(interfaces) {
  const summary = {
    total: interfaces.length,
    physical: 0,
    connected: 0,
    accessPorts: 0,
    trunkPorts: 0,
    describedPorts: 0,
    connectedUnusedPorts: 0,
  };
  for (const iface of interfaces) {
    if (iface.type === 'physical') summary.physical++;
    if (iface.link_connected) summary.connected++;
    if (iface.port_mode === 'access') summary.accessPorts++;
    if (iface.port_mode === 'trunk') summary.trunkPorts++;
    if (iface.description) summary.describedPorts++;
    if (iface.link_connected && iface.unused) summary.connectedUnusedPorts++;
  }
  return summary;
}

function nodeEvidence(node, interfaces, bonds) {
  const modelArtifact = isTimestampArtifact(node.model);
  const descriptionArtifact = isTimestampArtifact(node.system_descr);
  const capabilities = parseJsonArray(node.capabilities);
  const bondMembers = new Set(bonds.map(bond => bond.member_name).filter(Boolean));
  return {
    inventory: {
      vendor: node.vendor || null,
      model: modelArtifact ? null : node.model || null,
      os: [node.os_name, node.os_version].filter(Boolean).join(' ') || null,
      capabilities,
      routingCapable: node.role === 'router' || capabilities.includes('Router'),
      managementIpCount: parseJsonArray(node.mgmt_ips).length,
    },
    interfaceSummary: interfaceSummary(interfaces),
    resiliency: bonds.length ? {
      mode: [...new Set(bonds.map(bond => bond.bond_mode).filter(Boolean))],
      lacpRate: [...new Set(bonds.map(bond => bond.bond_lacp_rate).filter(Boolean))],
      memberCount: bondMembers.size,
    } : null,
    sourceQuality: {
      modelTimestampArtifact: modelArtifact,
      descriptionTimestampArtifact: descriptionArtifact,
      unresolved: node.node_type === 'unknown' || node.id.startsWith('unresolved-'),
    },
  };
}

function sourceNodeMetadata(node, extra = {}) {
  return {
    sourceId: node.id,
    sourceType: node.node_type || 'unknown',
    hostname: node.hostname || null,
    vendor: node.vendor || null,
    model: isTimestampArtifact(node.model) ? null : node.model || null,
    role: node.role || null,
    ...extra,
  };
}

function normalizeIdentifier(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function compactMaaSRecord(machine, zonesById, poolsById) {
  const zone = zonesById.get(machine.zone_id);
  const pool = poolsById.get(machine.pool_id);
  return {
    id: machine.id ?? null,
    systemId: machine.system_id ?? null,
    hostname: machine.hostname ?? null,
    zone: zone ? { id: zone.id, name: zone.name } : null,
    pool: pool ? { id: pool.id, name: pool.name, isDefault: pool.is_default } : null,
    status: machine.status ?? null,
    powerState: machine.power_state ?? null,
    cpuCount: machine.cpu_count ?? null,
    memory: machine.memory ?? null,
    storage: machine.storage ?? null,
    architecture: machine.architecture ?? null,
  };
}

function buildMaaSIndex(enrichment) {
  if (!enrichment) {
    return { records: 0, bySystemId: new Map(), byHostname: new Map() };
  }
  if (!Array.isArray(enrichment.machines) || !Array.isArray(enrichment.zones) ||
      !Array.isArray(enrichment.pools)) {
    throw new TypeError('MAAS enrichment must provide machines, zones, and pools arrays.');
  }

  const zonesById = new Map(enrichment.zones.map(zone => [zone.id, zone]));
  const poolsById = new Map(enrichment.pools.map(pool => [pool.id, pool]));
  const bySystemId = new Map();
  const byHostname = new Map();
  for (const machine of enrichment.machines) {
    const record = compactMaaSRecord(machine, zonesById, poolsById);
    const systemId = normalizeIdentifier(record.systemId);
    const hostname = normalizeIdentifier(record.hostname);
    if (systemId) bySystemId.set(systemId, record);
    if (hostname) byHostname.set(hostname, record);
  }
  return { records: enrichment.machines.length, bySystemId, byHostname };
}

function maasRecordForNode(node, maasIndex) {
  return maasIndex.bySystemId.get(normalizeIdentifier(node.id)) ||
    maasIndex.byHostname.get(normalizeIdentifier(node.hostname)) ||
    null;
}

function availabilityZoneFor(records) {
  const zones = [...new Set(records
    .map(record => record?.zone?.name)
    .filter(Boolean))].sort();
  return zones.length === 1 ? zones[0] : 'n/a';
}

function visualNode({
  id,
  ring,
  label,
  weight,
  metadata,
  plane = 'shared',
  leafRole = 'n/a',
  availabilityZone = 'n/a',
}) {
  return {
    id,
    ring,
    label,
    weight: Math.max(1, weight),
    plane,
    leaf_role: leafRole,
    trust_tier: 'n/a',
    failure_domain_role: 'n/a',
    rack_controller_ids: [],
    availability_zone: availabilityZone,
    metadata,
  };
}

function bestConfirmation(observations) {
  const present = new Set(observations.map(({ confirmedBy }) => confirmedBy).filter(Boolean));
  return CONFIRMATION_PRIORITY.find(value => present.has(value)) || 'unknown';
}

function summarizeObservations(observations) {
  const ports = new Map();
  const speedsMbps = new Set();
  const vlanIds = new Set();
  const nativeVlanIds = new Set();
  const taggedVlanIds = new Set();
  const vlanNames = new Set();
  const portModes = new Set();
  let connectedUnusedPortCount = 0;
  for (const observation of observations) {
    const key = `${observation.sourceNodeId || ''}\u0000${observation.localPortKey || ''}\u0000${observation.remotePort || ''}`;
    ports.set(key, {
      sourceNodeId: observation.sourceNodeId,
      localPort: observation.localPort,
      remotePort: observation.remotePort,
      mode: observation.portMode || null,
      status: observation.operStatus || null,
      description: observation.description || null,
    });
    if (observation.speedMbps) speedsMbps.add(observation.speedMbps);
    if (observation.vlanId) vlanIds.add(observation.vlanId);
    if (observation.nativeVlan) nativeVlanIds.add(observation.nativeVlan);
    observation.taggedVlans.forEach(vlan => taggedVlanIds.add(vlan));
    observation.vlanNames.forEach(name => vlanNames.add(name));
    if (observation.portMode) portModes.add(observation.portMode);
    if (observation.linkConnected && observation.unused) connectedUnusedPortCount++;
  }
  const managementVlanObserved = [...vlanNames].some(name => /mgmt/i.test(name));
  return {
    observationCount: observations.length,
    confirmedBy: bestConfirmation(observations),
    ports: [...ports.values()],
    portDetails: [...ports.values()],
    speedsMbps: [...speedsMbps].sort((a, b) => a - b),
    vlanIds: [...vlanIds].sort((a, b) => a - b),
    vlanEvidence: {
      nativeVlanIds: [...nativeVlanIds].sort((a, b) => a - b),
      taggedVlanIds: [...taggedVlanIds].sort((a, b) => a - b),
      names: [...vlanNames].sort(),
      managementVlanObserved,
    },
    portEvidence: {
      modes: [...portModes].sort(),
      connectedUnusedPortCount,
    },
  };
}

function vlanNamesForEdge(edge, vlanNamesById) {
  const names = new Set();
  for (const [vlanId, name] of Object.entries(edge.vlan_names || {})) {
    if (name) names.add(`${vlanId}:${name}`);
  }
  for (const vlanId of [edge.vlan_id, edge.native_vlan, ...(Array.isArray(edge.tagged_vlans) ? edge.tagged_vlans : [])]) {
    const name = vlanNamesById.get(vlanId);
    if (name) names.add(`${vlanId}:${name}`);
  }
  return [...names];
}

function sourceQuality(data, evidenceByNode, interfaceByPort, physicalLinks) {
  const values = [...evidenceByNode.values()];
  const sourceEdgesWithInterface = data.edges.filter(edge =>
    interfaceByPort.has(`${edge.local_node_id}\u0000${edge.local_port_key}`)
  ).length;
  const namedManagementVlanLinks = [...physicalLinks.values()]
    .filter(link => observedManagementVlan(link.observations)).length;
  return {
    unresolvedNodes: values.filter(value => value.sourceQuality.unresolved).length,
    timestampArtifacts: values.filter(value =>
      value.sourceQuality.modelTimestampArtifact || value.sourceQuality.descriptionTimestampArtifact
    ).length,
    explicitRouterNodes: data.nodes.filter(node => node.role === 'router').length,
    routingCapableNodes: values.filter(value => value.inventory.routingCapable).length,
    interfaceRecords: Array.isArray(data.interfaces) ? data.interfaces.length : 0,
    sourceEdgesWithInterface,
    bondRecords: Array.isArray(data.bonds) ? data.bonds.length : 0,
    bondedNodes: values.filter(value => value.resiliency).length,
    vlanDefinitions: data.vlans && typeof data.vlans === 'object' ? Object.keys(data.vlans).length : 0,
    namedManagementVlanLinks,
    connectedUnusedPorts: values.reduce(
      (total, value) => total + value.interfaceSummary.connectedUnusedPorts,
      0
    ),
  };
}

function validateTopology(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('LLDP topology must be an object.');
  }
  if (!Array.isArray(data.nodes)) {
    throw new TypeError('LLDP topology must contain a nodes array.');
  }
  if (!Array.isArray(data.edges)) {
    throw new TypeError('LLDP topology must contain an edges array.');
  }
}

function isManlan(node) {
  return /manlan/i.test(node.hostname || '');
}

function isFabricOrAggregation(node) {
  return /fabric|agg/i.test(node.hostname || '');
}

function switchPlane(node) {
  return isManlan(node) ? 'mgmt' : 'data';
}

function switchLeafRole(node) {
  return /border|wan|edge/i.test(node.hostname || '') ? 'border' : 'access';
}

function rackLocation(node) {
  const match = (node.hostname || '').match(/^et3-(dh\d+)-([a-z]?\d+)-/i);
  return match
    ? { hall: match[1].toLowerCase(), position: match[2].toLowerCase() }
    : null;
}

function buildDistanceMap(endpointIds, adjacency) {
  const distance = new Map(endpointIds.map(id => [id, 0]));
  const queue = [...endpointIds];
  for (let index = 0; index < queue.length; index++) {
    const nodeId = queue[index];
    for (const neighborId of adjacency.get(nodeId) || []) {
      if (distance.has(neighborId)) continue;
      distance.set(neighborId, distance.get(nodeId) + 1);
      queue.push(neighborId);
    }
  }
  return distance;
}

function inferSwitchTiers(switchIds, endpointIds, adjacency) {
  const distance = buildDistanceMap(endpointIds, adjacency);
  const tierById = new Map();
  for (const switchId of switchIds) {
    const hops = distance.get(switchId);
    if (hops === 1) {
      tierById.set(switchId, 'access');
    } else if (hops === 2) {
      tierById.set(switchId, 'fabric');
    } else {
      tierById.set(switchId, 'core');
    }
  }
  return { distance, tierById };
}

function buildManlanFrames(accessIds, switchIds, nodeById, adjacency) {
  const parent = new Map();
  const find = id => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(id) !== root) {
      const next = parent.get(id);
      parent.set(id, root);
      id = next;
    }
    return root;
  };
  const union = (first, second) => parent.set(find(first), find(second));
  const accessSet = new Set(accessIds);

  for (const switchId of switchIds) {
    const manlan = nodeById.get(switchId);
    if (!isManlan(manlan) || isFabricOrAggregation(manlan)) continue;
    const manlanLocation = rackLocation(manlan);
    for (const neighborId of adjacency.get(switchId) || []) {
      if (!accessSet.has(neighborId)) continue;
      const neighbor = nodeById.get(neighborId);
      if (isManlan(neighbor) || isFabricOrAggregation(neighbor)) continue;
      const neighborLocation = rackLocation(neighbor);
      if (!manlanLocation || !neighborLocation || manlanLocation.hall !== neighborLocation.hall) continue;
      union(switchId, neighborId);
    }
  }

  const membersByRoot = new Map();
  for (const accessId of accessIds) {
    if (!parent.has(accessId)) continue;
    const root = find(accessId);
    const members = membersByRoot.get(root) || [];
    members.push(accessId);
    membersByRoot.set(root, members);
  }

  const frameByAccessId = new Map();
  let frameNumber = 0;
  for (const members of [...membersByRoot.values()].sort((first, second) =>
    compareRawNodes(nodeById.get(first[0]), nodeById.get(second[0]))
  )) {
    const hasPosition = members.some(id => rackLocation(nodeById.get(id)));
    if (members.length < 2 || !hasPosition) continue;
    const frameLabel = `Frame ${++frameNumber}`;
    members.forEach(id => frameByAccessId.set(id, frameLabel));
  }
  return frameByAccessId;
}

function observedManagementVlan(observations) {
  return observations.some(observation => observation.vlanNames.some(name => /mgmt/i.test(name)));
}

function linkPlane(firstNode, secondNode, observations = []) {
  return observedManagementVlan(observations) || isManlan(firstNode) || isManlan(secondNode)
    ? 'mgmt'
    : 'data';
}

function planeEvidence(firstNode, secondNode, observations = []) {
  if (observedManagementVlan(observations)) return 'observed-vlan-name';
  if (isManlan(firstNode) || isManlan(secondNode)) return 'inferred-manlan-hostname';
  return 'inferred-default-data';
}

/**
 * Converts an exported LLDP topology into D3's static fixture contract.
 *
 * The adapter never merges source nodes by hostname. LLDP observations are
 * aggregated by their exact endpoint pair; source IDs and port evidence remain
 * available in the emitted node/link metadata.
 */
export function normalizeLldpTopology(data, { id, name, maasEnrichment } = {}) {
  validateTopology(data);

  const nodeById = new Map();
  for (const node of data.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id) {
      throw new TypeError('Every LLDP node must have a non-empty string id.');
    }
    if (nodeById.has(node.id)) {
      throw new Error(`LLDP topology contains duplicate node id "${node.id}".`);
    }
    nodeById.set(node.id, node);
  }
  const maasIndex = buildMaaSIndex(maasEnrichment);
  const maasByNodeId = new Map(
    data.nodes
      .map(node => [node.id, maasRecordForNode(node, maasIndex)])
      .filter(([, record]) => record)
  );
  const maasForNode = node => maasByNodeId.get(node.id) || null;
  const availabilityZoneForNode = node => availabilityZoneFor([maasForNode(node)]);

  const diagnostics = {
    malformedEdges: 0,
    danglingEdges: 0,
    selfEdges: 0,
  };
  const validEdges = [];
  for (const edge of data.edges) {
    if (!edge || typeof edge.local_node_id !== 'string' ||
        typeof edge.remote_node_id !== 'string') {
      diagnostics.malformedEdges++;
      continue;
    }
    if (!nodeById.has(edge.local_node_id) || !nodeById.has(edge.remote_node_id)) {
      diagnostics.danglingEdges++;
      continue;
    }
    if (edge.local_node_id === edge.remote_node_id) {
      diagnostics.selfEdges++;
      continue;
    }
    validEdges.push(edge);
  }

  const datasetId = id || 'lldp';
  const fixturePrefix = `lldp:${datasetId}`;
  const switchIds = new Set(
    data.nodes.filter(node => node.node_type === 'switch').map(node => node.id)
  );
  const endpointIds = new Set(
    data.nodes.filter(node => node.node_type !== 'switch').map(node => node.id)
  );
  const vlanNamesById = new Map(
    Object.values(data.vlans || {})
      .filter(vlan => vlan && vlan.name)
      .map(vlan => [Number(vlan.vlan_id), vlan.name])
  );
  const interfacesByNode = new Map(data.nodes.map(node => [node.id, []]));
  const interfaceByPort = new Map();
  for (const iface of data.interfaces || []) {
    if (!interfacesByNode.has(iface.node_id)) continue;
    interfacesByNode.get(iface.node_id).push(iface);
    interfaceByPort.set(`${iface.node_id}\u0000${iface.port_key}`, iface);
  }
  const bondsByNode = new Map(data.nodes.map(node => [node.id, []]));
  for (const bond of data.bonds || []) {
    if (bondsByNode.has(bond.node_id)) bondsByNode.get(bond.node_id).push(bond);
  }
  const evidenceByNode = new Map(data.nodes.map(node => [
    node.id,
    nodeEvidence(node, interfacesByNode.get(node.id), bondsByNode.get(node.id)),
  ]));
  const metadataForNode = (node, extra = {}) => {
    const evidence = evidenceByNode.get(node.id);
    const maas = maasForNode(node);
    return sourceNodeMetadata(node, {
      provenance: 'observed',
      inventory: evidence.inventory,
      interfaceSummary: evidence.interfaceSummary,
      resiliency: evidence.resiliency,
      sourceQuality: evidence.sourceQuality,
      ...(maas ? { maas } : {}),
      ...extra,
    });
  };
  const adjacency = new Map([...nodeById.keys()].map(nodeId => [nodeId, new Set()]));
  const physicalLinks = new Map();

  for (const edge of validEdges) {
    adjacency.get(edge.local_node_id).add(edge.remote_node_id);
    adjacency.get(edge.remote_node_id).add(edge.local_node_id);

    const [first, second] = [edge.local_node_id, edge.remote_node_id].sort();
    const key = `${first}\u0000${second}`;
    const link = physicalLinks.get(key) || {
      endpointIds: [first, second],
      observations: [],
    };
    const iface = interfaceByPort.get(`${edge.local_node_id}\u0000${edge.local_port_key}`);
    link.observations.push({
      sourceNodeId: edge.local_node_id,
      localPort: edge.local_port_name || null,
      remotePort: edge.remote_port_id || edge.remote_port_descr || null,
      localPortKey: edge.local_port_key || null,
      confirmedBy: edge.confirmed_by || null,
      speedMbps: edge.speed_mbps || null,
      vlanId: edge.vlan_id || null,
      nativeVlan: edge.native_vlan || null,
      taggedVlans: Array.isArray(edge.tagged_vlans) ? edge.tagged_vlans : [],
      vlanNames: vlanNamesForEdge(edge, vlanNamesById),
      portMode: iface?.port_mode || edge.vlan_mode || null,
      operStatus: iface?.oper_status || null,
      description: iface?.description || null,
      linkConnected: Boolean(iface?.link_connected),
      unused: Boolean(iface?.unused),
    });
    physicalLinks.set(key, link);
  }

  const { distance, tierById } = inferSwitchTiers(switchIds, [...endpointIds], adjacency);
  const accessNodes = [...switchIds]
    .filter(nodeId => tierById.get(nodeId) === 'access')
    .map(nodeId => nodeById.get(nodeId))
    .sort(compareRawNodes);
  const fabricNodes = [...switchIds]
    .filter(nodeId => tierById.get(nodeId) === 'fabric')
    .map(nodeId => nodeById.get(nodeId))
    .sort(compareRawNodes);
  const coreNodes = [...switchIds]
    .filter(nodeId => tierById.get(nodeId) === 'core')
    .map(nodeId => nodeById.get(nodeId))
    .sort(compareRawNodes);
  const endpointNodes = data.nodes.filter(node => endpointIds.has(node.id)).sort(compareRawNodes);
  const accessIds = new Set(accessNodes.map(node => node.id));
  const frameByAccessId = buildManlanFrames(
    accessNodes.map(node => node.id),
    switchIds,
    nodeById,
    adjacency
  );

  const primaryAccessByEndpoint = new Map();
  const accessByEndpoint = new Map();
  const unassignedEndpoints = [];

  for (const endpoint of endpointNodes) {
    const accessNeighbors = [...adjacency.get(endpoint.id)]
      .filter(nodeId => accessIds.has(nodeId))
      .map(nodeId => nodeById.get(nodeId))
      .sort((first, second) => {
        const planeOrder = switchPlane(first).localeCompare(switchPlane(second));
        return planeOrder || compareRawNodes(first, second);
      });
    if (accessNeighbors.length === 0) {
      unassignedEndpoints.push(endpoint);
      continue;
    }
    primaryAccessByEndpoint.set(endpoint.id, accessNeighbors[0].id);
    accessByEndpoint.set(endpoint.id, accessNeighbors.map(node => node.id));
  }

  const rackByAccessId = new Map();
  const rackCandidates = new Map();
  for (const access of accessNodes) {
    const location = rackLocation(access);
    const key = location ? `${location.hall}/${location.position}` : `switch:${access.id}`;
    const candidate = rackCandidates.get(key) || {
      key,
      hall: location?.hall || null,
      position: location?.position || null,
      accessIds: [],
    };
    candidate.accessIds.push(access.id);
    rackCandidates.set(key, candidate);
    rackByAccessId.set(access.id, key);
  }
  const frameForRack = rack => rack.accessIds
    .map(accessId => frameByAccessId.get(accessId))
    .find(Boolean) || null;
  const frameOrder = frame => frame ? Number(frame.replace('Frame ', '')) : Number.MAX_SAFE_INTEGER;
  const sortedRacks = [...rackCandidates.values()].sort((first, second) =>
    (first.hall || '').localeCompare(second.hall || '') ||
    frameOrder(frameForRack(first)) - frameOrder(frameForRack(second)) ||
    (first.position || '').localeCompare(second.position || '') ||
    first.key.localeCompare(second.key)
  );

  const primaryRackByEndpoint = new Map();
  const endpointsByRack = new Map(sortedRacks.map(rack => [rack.key, []]));
  for (const endpoint of endpointNodes) {
    const primaryAccessId = primaryAccessByEndpoint.get(endpoint.id);
    const rackKey = primaryAccessId ? rackByAccessId.get(primaryAccessId) : '__unassigned__';
    primaryRackByEndpoint.set(endpoint.id, rackKey);
    if (!endpointsByRack.has(rackKey)) endpointsByRack.set(rackKey, []);
    endpointsByRack.get(rackKey).push(endpoint);
  }

  const stackGroupsById = new Map();
  const stackGroupByRackKey = new Map();
  const stackGroupByAccessId = new Map();
  for (const rack of sortedRacks) {
    const frame = frameForRack(rack);
    const id = frame
      ? `frame:${frame.replace('Frame ', '').padStart(2, '0')}`
      : rack.hall
        ? `hall:${rack.hall}`
        : 'unassigned';
    const label = frame || (rack.hall ? `Hall ${rack.hall}` : 'Unassigned');
    const group = stackGroupsById.get(id) || {
      id,
      label,
      weight: 0,
      order: stackGroupsById.size,
    };
    group.weight += (endpointsByRack.get(rack.key) || []).length;
    stackGroupsById.set(id, group);
    stackGroupByRackKey.set(rack.key, id);
    rack.accessIds.forEach(accessId => stackGroupByAccessId.set(accessId, id));
  }

  const endpointCountByAccess = new Map(accessNodes.map(node => [node.id, 0]));
  for (const [endpointId, accessId] of primaryAccessByEndpoint) {
    endpointCountByAccess.set(accessId, (endpointCountByAccess.get(accessId) || 0) + 1);
  }
  const accessByFabric = new Map(fabricNodes.map(node => [node.id, new Set()]));
  const fabricByCore = new Map(coreNodes.map(node => [node.id, new Set()]));
  const physicalByPair = (firstId, secondId) =>
    physicalLinks.get([firstId, secondId].sort().join('\u0000'));

  for (const physicalLink of physicalLinks.values()) {
    const [first, second] = physicalLink.endpointIds;
    if (tierById.get(first) === 'fabric' && tierById.get(second) === 'access') {
      accessByFabric.get(first).add(second);
    } else if (tierById.get(second) === 'fabric' && tierById.get(first) === 'access') {
      accessByFabric.get(second).add(first);
    } else if (tierById.get(first) === 'core' && tierById.get(second) === 'fabric') {
      fabricByCore.get(first).add(second);
    } else if (tierById.get(second) === 'core' && tierById.get(first) === 'fabric') {
      fabricByCore.get(second).add(first);
    }
  }
  const stackGroupsByFabricId = new Map(fabricNodes.map(node => [
    node.id,
    new Set([...accessByFabric.get(node.id)].map(accessId => stackGroupByAccessId.get(accessId)).filter(Boolean)),
  ]));
  const stackViewGroups = [...stackGroupsById.values()];
  const hasStackView = stackViewGroups.length >= 2;

  const nodes = [
    visualNode({
      id: `${fixturePrefix}:root`,
      ring: 'R1',
      label: name || datasetId,
      weight: endpointNodes.length,
      metadata: {
        source: 'LLDP',
        datasetId,
        provenance: 'synthetic',
        description: 'Synthetic root added by the LLDP fixture generator.',
      },
    }),
  ];
  const links = [];
  const emittedLinks = new Map();

  function addLink({
    source,
    target,
    plane = 'shared',
    type,
    observations = [],
    synthetic = false,
    planeSource = null,
  }) {
    const key = `${source}\u0000${target}\u0000${plane}\u0000${type}`;
    const existing = emittedLinks.get(key);
    if (existing) {
      existing._observations.push(...observations);
      existing.weight = existing._observations.length || 1;
      return;
    }
    const link = {
      id: `${fixturePrefix}:link:${encodeURIComponent(source)}:${encodeURIComponent(target)}:${type}:${plane}`,
      source,
      target,
      plane,
      type,
      weight: observations.length || 1,
      metadata: { synthetic, ...(planeSource ? { planeEvidence: planeSource } : {}) },
      _observations: [...observations],
    };
    emittedLinks.set(key, link);
    links.push(link);
  }

  const visualCoreId = nodeId => `${fixturePrefix}:core:${nodeId}`;
  const visualFabricId = nodeId => `${fixturePrefix}:fabric:${nodeId}`;
  const visualAccessId = nodeId => `${fixturePrefix}:access:${nodeId}`;
  const visualRackId = rackKey => `${fixturePrefix}:rack:${rackKey}`;
  const visualEndpointId = endpointId => `${fixturePrefix}:endpoint:${endpointId}`;

  for (const core of coreNodes) {
    const servedEndpointWeight = [...fabricByCore.get(core.id)]
      .flatMap(fabricId => [...accessByFabric.get(fabricId)])
      .reduce((total, accessId) => total + (endpointCountByAccess.get(accessId) || 1), 0);
    nodes.push(visualNode({
      id: visualCoreId(core.id),
      ring: 'R2',
      label: labelFor(core),
      weight: servedEndpointWeight,
      plane: switchPlane(core),
      availabilityZone: availabilityZoneForNode(core),
      metadata: metadataForNode(core, {
        inferredTier: 'core-transit',
        endpointDistance: distance.get(core.id) ?? null,
        description: 'LLDP switch inferred as core/transit because it is three or more physical hops from an endpoint.',
      }),
    }));
    addLink({
      source: `${fixturePrefix}:root`,
      target: visualCoreId(core.id),
      plane: switchPlane(core),
      type: 'routing_adjacency',
      synthetic: true,
    });
  }

  for (const fabric of fabricNodes) {
    const servedEndpointWeight = [...accessByFabric.get(fabric.id)]
      .reduce((total, accessId) => total + (endpointCountByAccess.get(accessId) || 1), 0);
    nodes.push(visualNode({
      id: visualFabricId(fabric.id),
      ring: 'R3',
      label: labelFor(fabric),
      weight: servedEndpointWeight,
      plane: switchPlane(fabric),
      availabilityZone: availabilityZoneForNode(fabric),
      metadata: metadataForNode(fabric, {
        inferredTier: 'fabric-aggregation',
        endpointDistance: distance.get(fabric.id) ?? null,
        stackGroups: [...stackGroupsByFabricId.get(fabric.id)],
        description: 'LLDP switch inferred as fabric aggregation because it is two physical hops from an endpoint.',
      }),
    }));
  }

  for (const access of accessNodes) {
    nodes.push(visualNode({
      id: visualAccessId(access.id),
      ring: 'R4',
      label: labelFor(access),
      weight: endpointCountByAccess.get(access.id) || 1,
      plane: switchPlane(access),
      leafRole: switchLeafRole(access),
      availabilityZone: availabilityZoneForNode(access),
      metadata: metadataForNode(access, {
        inferredTier: 'access-tor',
        endpointDistance: distance.get(access.id),
        rackCandidate: rackByAccessId.get(access.id),
        frame: frameByAccessId.get(access.id) || null,
        stackGroup: stackGroupByAccessId.get(access.id) || 'unassigned',
        description: 'LLDP switch inferred as access/ToR because it directly neighbors an endpoint.',
      }),
    }));
  }

  for (const rack of sortedRacks) {
    const accessNodesForRack = rack.accessIds.map(accessId => nodeById.get(accessId));
    const frame = frameForRack(rack);
    const endpoints = endpointsByRack.get(rack.key) || [];
    const rackZoneNames = [...new Set(endpoints
      .map(endpoint => maasForNode(endpoint)?.zone?.name)
      .filter(Boolean))].sort();
    nodes.push(visualNode({
      id: visualRackId(rack.key),
      ring: 'R5',
      label: rack.position
        ? `${frame ? `${frame} · ` : ''}Rack ${rack.hall} · ${rack.position}`
        : `Rack · ${labelFor(accessNodesForRack[0])}`,
      weight: endpoints.length,
      availabilityZone: availabilityZoneFor(endpoints.map(maasForNode)),
      metadata: {
        source: 'LLDP',
        provenance: 'inferred',
        hall: rack.hall,
        position: rack.position,
        frame,
        stackGroup: stackGroupByRackKey.get(rack.key),
        accessSwitchSourceIds: rack.accessIds,
        maasZoneNames: rackZoneNames,
        description: frame
          ? `Physical rack candidate grouped by hostname and ${frame} management-LAN evidence.`
          : 'Physical rack candidate grouped from access-switch hostname evidence.',
      },
    }));
    for (const accessId of rack.accessIds) {
      addLink({
        source: visualAccessId(accessId),
        target: visualRackId(rack.key),
        type: 'containment',
        synthetic: true,
      });
    }
  }

  if (unassignedEndpoints.length > 0) {
    const unassignedAccessId = `${fixturePrefix}:access:unassigned`;
    const unassignedRackId = `${fixturePrefix}:rack:unassigned`;
    nodes.push(visualNode({
      id: unassignedAccessId,
      ring: 'R4',
      label: 'Unassigned endpoints',
      weight: unassignedEndpoints.length,
      leafRole: 'access',
      metadata: {
        source: 'LLDP',
        provenance: 'synthetic',
        stackGroup: 'unassigned',
        description: 'Synthetic leaf for endpoints without an LLDP-adjacent leaf switch.',
      },
    }));
    nodes.push(visualNode({
      id: unassignedRackId,
      ring: 'R5',
      label: 'Rack · Unassigned',
      weight: unassignedEndpoints.length,
      availabilityZone: availabilityZoneFor(unassignedEndpoints.map(maasForNode)),
      metadata: {
        source: 'LLDP',
        provenance: 'synthetic',
        stackGroup: 'unassigned',
        maasZoneNames: [...new Set(unassignedEndpoints
          .map(endpoint => maasForNode(endpoint)?.zone?.name)
          .filter(Boolean))].sort(),
        description: 'Synthetic rack for endpoints without an LLDP-adjacent leaf switch.',
      },
    }));
    addLink({
      source: `${fixturePrefix}:root`,
      target: unassignedAccessId,
      type: 'routing_adjacency',
      synthetic: true,
    });
    addLink({
      source: unassignedAccessId,
      target: unassignedRackId,
      type: 'containment',
      synthetic: true,
    });
  }

  for (const endpoint of endpointNodes) {
    const primaryAccessId = primaryAccessByEndpoint.get(endpoint.id);
    const rackKey = primaryRackByEndpoint.get(endpoint.id);
    const rackId = rackKey === '__unassigned__'
      ? `${fixturePrefix}:rack:unassigned`
      : visualRackId(rackKey);
    const accessAttachmentIds = accessByEndpoint.get(endpoint.id) || [];
    const secondaryAccessIds = accessAttachmentIds.filter(accessId =>
      rackByAccessId.get(accessId) !== rackKey
    );
    const rackObservations = accessAttachmentIds
      .filter(accessId => rackByAccessId.get(accessId) === rackKey)
      .flatMap(accessId => physicalByPair(accessId, endpoint.id)?.observations || []);
    const endpointObservations = [...physicalLinks.values()]
      .filter(link => link.endpointIds.includes(endpoint.id))
      .flatMap(link => link.observations);
    const descriptions = [...new Set(endpointObservations
      .map(observation => observation.description)
      .filter(Boolean))];
    const observedRackCandidates = [...new Set(accessAttachmentIds
      .map(accessId => rackByAccessId.get(accessId))
      .filter(Boolean))];
    const baseEvidence = evidenceByNode.get(endpoint.id);
    const resiliency = baseEvidence.resiliency ? {
        ...baseEvidence.resiliency,
        observedAccessSwitchCount: accessAttachmentIds.length,
        observedRackCandidateCount: observedRackCandidates.length,
        status: observedRackCandidates.length > 1 ? 'multi-rack-observed' : 'single-rack-observed',
      } : null;
    const resolution = baseEvidence.sourceQuality.unresolved ? {
        status: 'unresolved',
        interfaceDescriptions: descriptions,
      } : null;
    nodes.push(visualNode({
      id: visualEndpointId(endpoint.id),
      ring: 'R6',
      label: labelFor(endpoint),
      weight: 1,
      availabilityZone: availabilityZoneForNode(endpoint),
      metadata: metadataForNode(endpoint, {
        resiliency,
        resolution,
        rack: rackId,
        primaryAccessSourceId: primaryAccessId || null,
        secondaryAccessSourceIds: secondaryAccessIds,
        stackGroup: rackKey === '__unassigned__'
          ? 'unassigned'
          : stackGroupByRackKey.get(rackKey),
        description: secondaryAccessIds.length
          ? `LLDP endpoint with ${secondaryAccessIds.length + 1} access-switch attachments.`
          : 'LLDP endpoint shown in its inferred physical rack candidate.',
      }),
    }));
    addLink({
      source: rackId,
      target: visualEndpointId(endpoint.id),
      plane: primaryAccessId
        ? linkPlane(nodeById.get(primaryAccessId), endpoint, rackObservations)
        : 'shared',
      planeSource: primaryAccessId
        ? planeEvidence(nodeById.get(primaryAccessId), endpoint, rackObservations)
        : null,
      type: 'containment',
      observations: rackObservations,
      synthetic: rackObservations.length === 0,
    });
    for (const secondaryAccessId of secondaryAccessIds) {
      const access = nodeById.get(secondaryAccessId);
      addLink({
        source: visualAccessId(secondaryAccessId),
        target: visualEndpointId(endpoint.id),
        plane: linkPlane(
          access,
          endpoint,
          physicalByPair(secondaryAccessId, endpoint.id)?.observations || []
        ),
        planeSource: planeEvidence(
          access,
          endpoint,
          physicalByPair(secondaryAccessId, endpoint.id)?.observations || []
        ),
        type: 'routing_adjacency',
        observations: physicalByPair(secondaryAccessId, endpoint.id)?.observations || [],
      });
    }
  }

  const hasUpstream = new Set();
  for (const physicalLink of physicalLinks.values()) {
    const [first, second] = physicalLink.endpointIds;
    if (!switchIds.has(first) || !switchIds.has(second)) continue;
    const firstTier = tierById.get(first);
    const secondTier = tierById.get(second);
    const firstNode = nodeById.get(first);
    const secondNode = nodeById.get(second);
    const visualIdFor = (nodeId, tier) => {
      if (tier === 'core') return visualCoreId(nodeId);
      if (tier === 'fabric') return visualFabricId(nodeId);
      return visualAccessId(nodeId);
    };
    if (firstTier === secondTier) {
      addLink({
        source: visualIdFor(first, firstTier),
        target: visualIdFor(second, secondTier),
        plane: linkPlane(firstNode, secondNode, physicalLink.observations),
        planeSource: planeEvidence(firstNode, secondNode, physicalLink.observations),
        type: 'peer_adjacency',
        observations: physicalLink.observations,
      });
      continue;
    }
    const ringByTier = { core: 2, fabric: 3, access: 4 };
    const [sourceId, sourceTier, targetId, targetTier] = ringByTier[firstTier] < ringByTier[secondTier]
      ? [first, firstTier, second, secondTier]
      : [second, secondTier, first, firstTier];
    hasUpstream.add(targetId);
    addLink({
      source: visualIdFor(sourceId, sourceTier),
      target: visualIdFor(targetId, targetTier),
      plane: linkPlane(firstNode, secondNode, physicalLink.observations),
      planeSource: planeEvidence(firstNode, secondNode, physicalLink.observations),
      type: 'routing_adjacency',
      observations: physicalLink.observations,
    });
  }

  for (const fabric of fabricNodes) {
    if (hasUpstream.has(fabric.id)) continue;
    addLink({
      source: `${fixturePrefix}:root`,
      target: visualFabricId(fabric.id),
      plane: switchPlane(fabric),
      type: 'routing_adjacency',
      synthetic: true,
    });
  }
  for (const access of accessNodes) {
    if (hasUpstream.has(access.id)) continue;
    addLink({
      source: `${fixturePrefix}:root`,
      target: visualAccessId(access.id),
      plane: switchPlane(access),
      type: 'routing_adjacency',
      synthetic: true,
    });
  }

  for (const physicalLink of physicalLinks.values()) {
    const [first, second] = physicalLink.endpointIds;
    const firstIsSwitch = switchIds.has(first);
    const secondIsSwitch = switchIds.has(second);
    if (firstIsSwitch === secondIsSwitch) continue;
    const switchId = firstIsSwitch ? first : second;
    const endpointId = firstIsSwitch ? second : first;
    if (tierById.get(switchId) === 'access') continue;
    const switchNode = nodeById.get(switchId);
    const visualSwitchId = tierById.get(switchId) === 'core'
      ? visualCoreId(switchId)
      : visualFabricId(switchId);
    addLink({
      source: visualSwitchId,
      target: visualEndpointId(endpointId),
      plane: linkPlane(switchNode, nodeById.get(endpointId), physicalLink.observations),
      planeSource: planeEvidence(switchNode, nodeById.get(endpointId), physicalLink.observations),
      type: 'routing_adjacency',
      observations: physicalLink.observations,
    });
  }

  for (const physicalLink of physicalLinks.values()) {
    const [first, second] = physicalLink.endpointIds;
    if (!endpointIds.has(first) || !endpointIds.has(second)) continue;
    addLink({
      source: visualEndpointId(first),
      target: visualEndpointId(second),
      plane: linkPlane(nodeById.get(first), nodeById.get(second), physicalLink.observations),
      planeSource: planeEvidence(nodeById.get(first), nodeById.get(second), physicalLink.observations),
      type: 'peer_adjacency',
      observations: physicalLink.observations,
    });
  }

  for (const core of coreNodes) {
    if (distance.has(core.id)) continue;
    addLink({
      source: `${fixturePrefix}:root`,
      target: visualCoreId(core.id),
      plane: switchPlane(core),
      type: 'routing_adjacency',
      synthetic: true,
    });
  }

  for (const link of links) {
    link.metadata.provenance = link.metadata.synthetic ? 'synthetic' : 'observed';
    if (link._observations.length > 0) {
      Object.assign(link.metadata, summarizeObservations(link._observations));
    }
    delete link._observations;
  }

  const tierCounts = { access: accessNodes.length, fabric: fabricNodes.length, core: coreNodes.length };
  const frameCount = new Set(frameByAccessId.values()).size;

  return {
    nodes,
    links,
    meta: {
      schemaVersion: 3,
      option: datasetId,
      centerLabel: 'LLDP',
      label: name || datasetId,
      title: `LLDP · ${name || datasetId}`,
      subtitle: `LLDP topology · ${data.nodes.length} source nodes · ${validEdges.length} observations`,
      ringNames: { R1: 'Topology', R2: 'Core / Transit', R3: 'Fabric', R4: 'Access / ToR', R5: 'Rack / Frame', R6: 'Endpoint' },
      stackView: {
        enabled: hasStackView,
        groupLabel: 'Frame / Hall',
        groups: stackViewGroups,
      },
      sourceQuality: sourceQuality(data, evidenceByNode, interfaceByPort, physicalLinks),
      diagnostics: {
        ...diagnostics,
        sourceNodes: data.nodes.length,
        sourceEdges: data.edges.length,
        validEdges: validEdges.length,
        physicalLinks: physicalLinks.size,
        tierCounts,
        rackCandidates: sortedRacks.length,
        frameCandidates: frameCount,
        unassignedEndpoints: unassignedEndpoints.length,
        maasEnrichmentRecords: maasIndex.records,
        maasMatchedNodes: maasByNodeId.size,
        maasMatchedEndpoints: endpointNodes.filter(node => maasByNodeId.has(node.id)).length,
        maasAvailabilityZones: new Set([...maasByNodeId.values()]
          .map(record => record.zone?.name)
          .filter(Boolean)).size,
        renderedNodes: nodes.length,
        renderedLinks: links.length,
      },
    },
  };
}
