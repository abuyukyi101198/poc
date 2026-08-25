import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeLldpTopology } from '../js/lldp-adapter.js';

const topology = {
  nodes: [
    { id: 'spine', hostname: 'spine-1', node_type: 'switch' },
    { id: 'leaf', hostname: 'leaf-1', node_type: 'switch' },
    { id: 'server', hostname: 'server-1', node_type: 'machine' },
  ],
  edges: [
    { local_node_id: 'spine', remote_node_id: 'leaf', confirmed_by: 'switch-to-switch' },
    { local_node_id: 'leaf', remote_node_id: 'server', local_port_name: 'eth1', confirmed_by: 'machine-and-switch' },
    { local_node_id: 'server', remote_node_id: 'leaf', local_port_name: 'eno1', confirmed_by: 'machine-and-switch' },
  ],
};

test('normalizes a topology into a radial fixture and aggregates reverse observations', () => {
  const fixture = normalizeLldpTopology(topology, { id: 'sample', name: 'Sample' });
  assert.equal(fixture.nodes.filter(node => node.ring === 'R1').length, 1);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R3').length, 1);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R4').length, 1);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R5').length, 1);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R6').length, 1);

  const endpointLink = fixture.links.find(link =>
    link.target === 'lldp:sample:endpoint:server'
  );
  assert.equal(endpointLink.metadata.observationCount, 2);
  assert.equal(endpointLink.metadata.ports.length, 2);
  assert.equal(endpointLink.metadata.confirmedBy, 'machine-and-switch');
  assert.equal(endpointLink.metadata.provenance, 'observed');
  assert.match(endpointLink.id, /^lldp:sample:link:/);
  assert.equal(
    fixture.nodes.find(node => node.id.endsWith(':access:leaf')).metadata.provenance,
    'observed'
  );
  assert.equal(
    fixture.nodes.find(node => node.ring === 'R5').metadata.provenance,
    'inferred'
  );
});

test('joins compact MAAS enrichment and derives a rack availability zone', () => {
  const fixture = normalizeLldpTopology({
    nodes: [
      { id: 'leaf', hostname: 'leaf-1', node_type: 'switch' },
      { id: 'server-source', hostname: 'server-1', node_type: 'machine' },
    ],
    edges: [{ local_node_id: 'leaf', remote_node_id: 'server-source' }],
  }, {
    id: 'maas',
    maasEnrichment: {
      machines: [{
        id: 42,
        system_id: 'unmatched-system-id',
        hostname: 'server-1',
        zone_id: 3,
        pool_id: 5,
        status: 'Ready',
        power_state: 'off',
        cpu_count: 16,
        memory: 64,
        storage: 1200,
        architecture: 'amd64/generic',
      }],
      zones: [{ id: 3, name: 'zone-a' }],
      pools: [{ id: 5, name: 'pool-a', is_default: false }],
    },
  });

  const endpoint = fixture.nodes.find(node => node.id.endsWith(':endpoint:server-source'));
  const rack = fixture.nodes.find(node => node.ring === 'R5');
  assert.equal(endpoint.availability_zone, 'zone-a');
  assert.deepEqual(endpoint.metadata.maas, {
    id: 42,
    systemId: 'unmatched-system-id',
    hostname: 'server-1',
    zone: { id: 3, name: 'zone-a' },
    pool: { id: 5, name: 'pool-a', isDefault: false },
    status: 'Ready',
    powerState: 'off',
    cpuCount: 16,
    memory: 64,
    storage: 1200,
    architecture: 'amd64/generic',
  });
  assert.equal(rack.availability_zone, 'zone-a');
  assert.deepEqual(rack.metadata.maasZoneNames, ['zone-a']);
  assert.equal(fixture.meta.diagnostics.maasMatchedNodes, 1);
  assert.equal(fixture.meta.diagnostics.maasMatchedEndpoints, 1);
});

test('reports dangling LLDP observations instead of emitting invalid fixture links', () => {
  const fixture = normalizeLldpTopology({
    ...topology,
    edges: [...topology.edges, { local_node_id: 'leaf', remote_node_id: 'missing' }],
  });
  assert.equal(fixture.meta.diagnostics.danglingEdges, 1);
});

test('infers physical switch tiers and groups same-position access switches into one rack', () => {
  const fixture = normalizeLldpTopology({
    nodes: [
      { id: 'core', hostname: 'et3-dh1-fabric-sw1', node_type: 'switch' },
      { id: 'fabric', hostname: 'et3-dh1-fabric-sw2', node_type: 'switch' },
      { id: 'access-data', hostname: 'et3-dh1-h1-100g', node_type: 'switch' },
      { id: 'access-mgmt', hostname: 'et3-dh1-h1-manlan', node_type: 'switch' },
      { id: 'server', hostname: 'server-1', node_type: 'machine' },
    ],
    edges: [
      { local_node_id: 'core', remote_node_id: 'fabric' },
      { local_node_id: 'fabric', remote_node_id: 'access-data' },
      { local_node_id: 'access-data', remote_node_id: 'server' },
      { local_node_id: 'access-mgmt', remote_node_id: 'server' },
    ],
  }, { id: 'tiers' });

  assert.equal(fixture.nodes.filter(node => node.ring === 'R2').length, 1);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R3').length, 1);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R4').length, 2);
  assert.equal(fixture.nodes.filter(node => node.ring === 'R5').length, 1);
  assert.equal(fixture.meta.diagnostics.rackCandidates, 1);

  const rack = fixture.nodes.find(node => node.ring === 'R5');
  assert.deepEqual(rack.metadata.accessSwitchSourceIds.sort(), ['access-data', 'access-mgmt']);
  assert.equal(
    fixture.nodes.find(node => node.id.endsWith(':access:access-mgmt')).plane,
    'mgmt'
  );
});

test('keeps attachments to a secondary physical rack as visible routing links', () => {
  const fixture = normalizeLldpTopology({
    nodes: [
      { id: 'access-1', hostname: 'et3-dh1-h1-100g', node_type: 'switch' },
      { id: 'access-2', hostname: 'et3-dh1-h2-100g', node_type: 'switch' },
      { id: 'server', hostname: 'server-1', node_type: 'machine' },
    ],
    edges: [
      { local_node_id: 'access-1', remote_node_id: 'server' },
      { local_node_id: 'access-2', remote_node_id: 'server' },
    ],
  }, { id: 'redundant' });

  assert.equal(fixture.nodes.filter(node => node.ring === 'R5').length, 2);
  assert.ok(fixture.links.some(link =>
    link.source === 'lldp:redundant:access:access-2' &&
    link.target === 'lldp:redundant:endpoint:server' &&
    link.type === 'routing_adjacency'
  ));
});

test('emits stack groups for multiple inferred physical halls', () => {
  const fixture = normalizeLldpTopology({
    nodes: [
      { id: 'access-1', hostname: 'et3-dh1-h1-100g', node_type: 'switch' },
      { id: 'access-2', hostname: 'et3-dh3-h1-100g', node_type: 'switch' },
      { id: 'server-1', hostname: 'server-1', node_type: 'machine' },
      { id: 'server-2', hostname: 'server-2', node_type: 'machine' },
    ],
    edges: [
      { local_node_id: 'access-1', remote_node_id: 'server-1' },
      { local_node_id: 'access-2', remote_node_id: 'server-2' },
    ],
  }, { id: 'stack' });

  assert.deepEqual(
    fixture.meta.stackView.groups.map(group => group.id),
    ['hall:dh1', 'hall:dh3']
  );
  assert.equal(
    fixture.nodes.find(node => node.id.endsWith(':access:access-1')).metadata.stackGroup,
    'hall:dh1'
  );
  assert.equal(
    fixture.nodes.find(node => node.id.endsWith(':endpoint:server-2')).metadata.stackGroup,
    'hall:dh3'
  );
});

test('enriches participating links and nodes with compact LLDP evidence', () => {
  const fixture = normalizeLldpTopology({
    nodes: [
      {
        id: 'access',
        hostname: 'access-1',
        node_type: 'switch',
        vendor: 'Example Networks',
        model: '### Timestamp: malformed export',
        os_name: 'ExampleOS',
        os_version: '1.2.3',
        capabilities: '["Bridge", "Router"]',
        mgmt_ips: '["10.0.0.1"]',
      },
      {
        id: 'server',
        hostname: 'server-1',
        node_type: 'machine',
        mgmt_ips: '["10.0.0.2"]',
      },
      {
        id: 'unresolved-IP',
        hostname: 'IP:',
        node_type: 'unknown',
      },
    ],
    edges: [
      {
        local_node_id: 'access',
        remote_node_id: 'server',
        local_port_name: 'Ethernet 1',
        local_port_key: 'eth1',
        remote_port_id: 'eno1',
        tagged_vlans: [999],
        vlan_mode: 'trunk',
        speed_mbps: 1000,
      },
      {
        local_node_id: 'access',
        remote_node_id: 'unresolved-IP',
        local_port_name: 'Ethernet 2',
        local_port_key: 'eth2',
        remote_port_id: '127.0.0.1/8',
      },
    ],
    interfaces: [
      {
        node_id: 'access',
        port_key: 'eth1',
        type: 'physical',
        link_connected: 1,
        oper_status: 'up',
        port_mode: 'trunk',
        description: 'server-1.eno1',
        unused: true,
      },
      {
        node_id: 'access',
        port_key: 'eth2',
        type: 'physical',
        link_connected: 1,
        oper_status: 'up',
        port_mode: 'access',
        description: 'unresolved neighbor',
        unused: false,
      },
      {
        node_id: 'access',
        port_key: 'eth99',
        type: 'physical',
        link_connected: 0,
        description: 'not part of the topology',
        unused: true,
      },
    ],
    bonds: [
      { node_id: 'server', bond_name: 'bond0', member_name: 'eno1', bond_mode: 'active-backup', bond_lacp_rate: 'fast' },
      { node_id: 'server', bond_name: 'bond0', member_name: 'eno2', bond_mode: 'active-backup', bond_lacp_rate: 'fast' },
    ],
    vlans: {
      999: { vlan_id: 999, name: 'mgmt' },
    },
  }, { id: 'evidence' });

  const serverLink = fixture.links.find(link =>
    link.target === 'lldp:evidence:endpoint:server'
  );
  assert.equal(serverLink.plane, 'mgmt');
  assert.equal(serverLink.metadata.planeEvidence, 'observed-vlan-name');
  assert.deepEqual(serverLink.metadata.vlanEvidence.names, ['999:mgmt']);
  assert.deepEqual(serverLink.metadata.portDetails, [{
    sourceNodeId: 'access',
    localPort: 'Ethernet 1',
    remotePort: 'eno1',
    mode: 'trunk',
    status: 'up',
    description: 'server-1.eno1',
  }]);

  const access = fixture.nodes.find(node => node.id.endsWith(':access:access'));
  assert.equal(access.metadata.inventory.model, null);
  assert.equal(access.metadata.inventory.managementIpCount, 1);
  assert.equal(access.metadata.inventory.routingCapable, true);
  assert.equal(access.metadata.sourceQuality.modelTimestampArtifact, true);
  assert.equal(access.metadata.interfaceSummary.connectedUnusedPorts, 1);

  const server = fixture.nodes.find(node => node.id.endsWith(':endpoint:server'));
  assert.equal(server.metadata.resiliency.memberCount, 2);
  assert.equal(server.metadata.resiliency.status, 'single-rack-observed');
  assert.equal(server.failure_domain_role, 'n/a');

  const unresolved = fixture.nodes.find(node => node.id.endsWith(':endpoint:unresolved-IP'));
  assert.deepEqual(unresolved.metadata.resolution, {
    status: 'unresolved',
    interfaceDescriptions: ['unresolved neighbor'],
  });
  assert.equal(fixture.meta.sourceQuality.namedManagementVlanLinks, 1);
  assert.equal(fixture.meta.sourceQuality.timestampArtifacts, 1);
  assert.equal(fixture.meta.sourceQuality.explicitRouterNodes, 0);
  assert.equal(fixture.meta.sourceQuality.routingCapableNodes, 1);
  assert.equal(JSON.stringify(fixture).includes('10.0.0.'), false);
  assert.equal(JSON.stringify(fixture).includes('not part of the topology'), false);
});

test('rejects duplicate source IDs', () => {
  assert.throws(
    () => normalizeLldpTopology({ nodes: [{ id: 'dup' }, { id: 'dup' }], edges: [] }),
    /duplicate node id/
  );
});
