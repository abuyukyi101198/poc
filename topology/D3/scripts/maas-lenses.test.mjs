import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAAS_LENSES,
  MAAS_STATUS_OPTIONS,
  createMaasModel,
  lensLegend,
  maasRackFill,
  maasServerFill,
  maasStatusColorGroup,
  maasStatusKey,
} from '../js/maas-lenses.js';

const endpoint = (id, maas, rack = 'rack-1', stackGroup = 'frame-1') => ({
  id,
  ring: 'R6',
  metadata: { maas, rack, stackGroup },
});

const maas = (status, architecture = 'amd64/generic', pool = 'default') => ({
  status,
  architecture,
  pool: { name: pool },
  cpuCount: 32,
  memory: 64,
  storage: 1000,
});

test('canonicalizes every supplied MAAS status label and groups colors semantically', () => {
  assert.equal(MAAS_STATUS_OPTIONS.length, 23);
  for (const status of MAAS_STATUS_OPTIONS) {
    assert.equal(maasStatusKey(status.key), status.key);
    assert.equal(maasStatusKey(status.label), status.key);
  }
  assert.equal(maasStatusColorGroup('failed_deployment'), 'attention');
  assert.equal(maasStatusColorGroup('deploying'), 'transition');
  assert.equal(maasStatusColorGroup('deployed'), 'active');
  assert.equal(maasStatusColorGroup('ready'), 'available');
  assert.equal(maasStatusColorGroup('retired'), 'inactive');
});

test('keeps Tenancy next to Topology and omits architecture as a lens', () => {
  assert.deepEqual(
    MAAS_LENSES.map(lens => lens.id),
    ['none', 'tenancy', 'status', 'cpu', 'memory', 'storage']
  );
});

test('aggregates only endpoint enrichment into existing physical containers', () => {
  const nodes = [
    { id: 'rack-1', ring: 'R5', metadata: {} },
    endpoint('ready', maas('Ready')),
    endpoint('failed', maas('Failed commissioning')),
    endpoint('unmatched', null),
  ];
  const model = createMaasModel(nodes);
  const rack = model.rackSummaries.get('rack-1');
  assert.deepEqual(model.coverage, { endpoints: 3, matched: 2, unmatched: 1 });
  assert.equal(rack.endpoints, 3);
  assert.equal(rack.matched, 2);
  assert.equal(rack.unmatched, 1);
  assert.equal(rack.statusCounts.get('failed_commissioning'), 1);
  assert.equal(model.groupSummaries.get('frame-1').capacity.cpu, 64);
});

test('returns optional fill data only for endpoint arcs', () => {
  const node = endpoint('matched', maas('Ready'));
  const rack = { id: 'rack-1', ring: 'R5', metadata: {} };
  const model = createMaasModel([rack, node]);
  assert.equal(maasServerFill(node, 'none', model), null);
  assert.deepEqual(maasServerFill(node, 'status', model), {
    tone: 'status-available',
    label: 'Ready',
  });
  assert.equal(maasServerFill(rack, 'status', model), null);
  assert.equal(maasServerFill(node, 'tenancy', model).label, 'default');
});

test('uses present canonical MAAS labels in the lifecycle legend', () => {
  const model = createMaasModel([
    endpoint('ready', maas('Ready')),
    endpoint('failed', maas('Failed deployment')),
    endpoint('deployed', maas('Deployed')),
    endpoint('deploying', maas('Deploying')),
  ]);
  assert.deepEqual(lensLegend('status', model), [
    { tone: 'status-attention', label: 'Failed deployment' },
    { tone: 'status-transition', label: 'Deploying' },
    { tone: 'status-active', label: 'Deployed' },
    { tone: 'status-available', label: 'Ready' },
  ]);
});

test('uses a sorted availability-zone legend in Topology view', () => {
  const zoneA = { ...endpoint('zone-a', maas('Ready')), availability_zone: 'zone-a' };
  const zoneB = { ...endpoint('zone-b', maas('Ready')), availability_zone: 'zone-b' };
  const legend = lensLegend('none', createMaasModel([zoneB, zoneA]));
  assert.deepEqual(legend.map(item => item.label), ['zone-a', 'zone-b']);
  assert.ok(legend.every(item => item.tone.startsWith('az-')));
});

test('uses fixture-relative capacity bands and leaves unavailable values unmatched', () => {
  const low = endpoint('low', { ...maas('Ready'), cpuCount: 4 });
  const high = endpoint('high', { ...maas('Ready'), cpuCount: 128 });
  const unavailable = endpoint('unavailable', { ...maas('Ready'), cpuCount: null });
  const model = createMaasModel([low, high, unavailable]);
  assert.equal(maasServerFill(low, 'cpu', model).tone, 'capacity-0');
  assert.equal(maasServerFill(high, 'cpu', model).tone, 'capacity-4');
  assert.equal(maasServerFill(unavailable, 'cpu', model).tone, 'unmatched');
});

test('compresses lifecycle into conservative rack health states', () => {
  const rack = { id: 'rack-1', ring: 'R5', metadata: {} };
  const failedModel = createMaasModel([
    rack,
    endpoint('ready', maas('Ready')),
    endpoint('failed', maas('Failed deployment')),
  ]);
  assert.deepEqual(maasRackFill(rack, 'status', failedModel), {
    tone: 'status-attention',
    label: 'Failed/broken',
    group: 'attention',
  });

  const transitionModel = createMaasModel([
    rack,
    endpoint('ready', maas('Ready')),
    endpoint('transition', maas('Deploying')),
  ]);
  assert.equal(maasRackFill(rack, 'status', transitionModel).tone, 'status-transition');
});

test('uses median capacity and dominant tenancy for rack fills', () => {
  const rack = { id: 'rack-1', ring: 'R5', metadata: {} };
  const capacityModel = createMaasModel([
    rack,
    endpoint('small-a', { ...maas('Ready'), cpuCount: 4 }),
    endpoint('small-b', { ...maas('Ready'), cpuCount: 4 }),
    endpoint('large', { ...maas('Ready'), cpuCount: 128 }),
  ]);
  assert.equal(maasRackFill(rack, 'cpu', capacityModel).tone, 'capacity-0');

  const dominantTenancy = createMaasModel([
    rack,
    endpoint('one', maas('Ready', 'amd64/generic', 'pool-a')),
    endpoint('two', maas('Ready', 'amd64/generic', 'pool-a')),
    endpoint('three', maas('Ready', 'amd64/generic', 'pool-a')),
    endpoint('four', maas('Ready', 'amd64/generic', 'pool-b')),
  ]);
  assert.equal(maasRackFill(rack, 'tenancy', dominantTenancy).label, 'pool-a');

  const mixedTenancy = createMaasModel([
    rack,
    endpoint('one', maas('Ready', 'amd64/generic', 'pool-a')),
    endpoint('two', maas('Ready', 'amd64/generic', 'pool-a')),
    endpoint('three', maas('Ready', 'amd64/generic', 'pool-b')),
    endpoint('four', maas('Ready', 'amd64/generic', 'pool-b')),
  ]);
  assert.deepEqual(maasRackFill(rack, 'tenancy', mixedTenancy), {
    tone: 'mixed',
    label: 'Mixed tenancy',
  });
});
