import assert from 'node:assert/strict';
import test from 'node:test';

import { investigationContext, lodForScale } from '../js/filters.js';
import { truncateArcLabel } from '../js/arc-label.js';
import { buildNodeLinksIndex, collectLineage } from '../js/lineage.js';
import { createViewState } from '../js/view-state.js';

const nodes = [
  {
    id: 'access',
    label: 'access-1',
    metadata: { inventory: { routingCapable: true } },
  },
  {
    id: 'endpoint',
    label: 'IP:',
    metadata: {
      sourceId: 'unresolved-IP',
      resiliency: { memberCount: 2 },
      sourceQuality: { unresolved: true },
    },
  },
  {
    id: 'maas-endpoint',
    ring: 'R6',
    label: 'compute-1',
    metadata: {
      maas: {
        hostname: 'compute-1',
        systemId: 'maas-123',
        architecture: 'arm64/generic',
        pool: { name: 'default' },
        status: 'Ready',
      },
    },
  },
  { id: 'other', label: 'other-host', metadata: {} },
];

const links = [
  {
    id: 'access-endpoint',
    source: 'access',
    target: 'endpoint',
    metadata: { vlanEvidence: { managementVlanObserved: true } },
  },
  { id: 'access-other', source: 'access', target: 'other', metadata: {} },
];

test('returns matched nodes and their immediate topology context', () => {
  const context = investigationContext(nodes, links, {
    query: 'ip:',
    filters: { unresolved: true },
  });
  assert.equal(context.active, true);
  assert.deepEqual([...context.matchedNodeIds], ['endpoint']);
  assert.deepEqual([...context.contextNodeIds].sort(), ['access', 'endpoint']);
});

test('filters management VLAN evidence through observed physical links', () => {
  const context = investigationContext(nodes, links, {
    filters: { managementVlan: true },
  });
  assert.deepEqual([...context.matchedLinkIds], ['access-endpoint']);
  assert.deepEqual([...context.matchedNodeIds].sort(), ['access', 'endpoint']);
});

test('uses three predictable radial detail levels', () => {
  assert.equal(lodForScale(0.7), 'overview');
  assert.equal(lodForScale(1), 'fabric');
  assert.equal(lodForScale(2), 'detail');
});

test('resets investigation state to safe defaults', () => {
  const changes = [];
  const state = createViewState(value => changes.push(value));
  state.update({
    query: 'access',
    maasLens: 'status',
    filters: { unresolved: true },
  });
  state.selectNode('access');
  state.reset();
  assert.equal(state.get().query, '');
  assert.equal(state.get().selection, null);
  assert.equal(state.get().filters.unresolved, false);
  assert.equal(state.get().maasLens, 'none');
  assert.ok(changes.length >= 3);
});

test('searches compact MAAS identity and inventory without matching non-endpoints', () => {
  const context = investigationContext(nodes, links, { query: 'arm64' });
  assert.deepEqual([...context.matchedNodeIds], ['maas-endpoint']);
});

test('truncates arc labels instead of suppressing narrow endpoint names', () => {
  const narrowEndpoint = {
    label: 'very-long-server-hostname',
    ring: 'R6',
    startAngle: 0,
    endAngle: 0.015,
    innerRadius: 390,
    outerRadius: 420,
  };
  const label = truncateArcLabel(narrowEndpoint);
  assert.notEqual(label, '');
  assert.ok(label === '…' || label.endsWith('…'));
  assert.ok(label.length < narrowEndpoint.label.length);
});

test('collects every ancestor for a selected endpoint lineage', () => {
  const layoutNodes = [
    { id: 'root', ring: 'R1' },
    { id: 'core', ring: 'R2' },
    { id: 'fabric', ring: 'R3' },
    { id: 'access', ring: 'R4' },
    { id: 'rack', ring: 'R5' },
    { id: 'endpoint', ring: 'R6' },
  ];
  const links = [
    { source: 'root', target: 'core' },
    { source: 'core', target: 'fabric' },
    { source: 'fabric', target: 'access' },
    { source: 'access', target: 'rack' },
    { source: 'rack', target: 'endpoint' },
  ];
  const nodeById = new Map(layoutNodes.map(node => [node.id, node]));
  const lineage = collectLineage(
    'endpoint',
    buildNodeLinksIndex(layoutNodes, links, nodeById),
    nodeById
  );
  assert.deepEqual(
    [...lineage.lineageNodeIds].sort(),
    ['access', 'core', 'endpoint', 'fabric', 'rack', 'root']
  );
});
