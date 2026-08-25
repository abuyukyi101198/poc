import assert from 'node:assert/strict';
import test from 'node:test';

import { filterMaasUiEnrichment } from './filter-maas-ui-enrichment.mjs';

test('retains only compact topology enrichment fields from the MAAS UI export', () => {
  const filtered = filterMaasUiEnrichment({
    machines: [{
      id: 42,
      system_id: 'machine-42',
      hostname: 'server-42',
      zone: { id: 3, name: 'zone-a' },
      pool: { id: 5, name: 'pool-a' },
      status: 'Ready',
      power_state: 'off',
      cpu_count: 16,
      memory: 64,
      storage: { parsedValue: 1200, source: '1200 GB' },
      architecture: 'amd64/generic',
      actions: ['deploy'],
      permissions: ['edit'],
      ip_addresses: [{ ip: '10.0.0.1' }],
      pxe_mac: '00:11:22:33:44:55',
      testing_status: { status: 0 },
    }],
    zones: [{ id: 3, name: 'zone-a', description: 'discarded', _links: { self: '/zones/3' } }],
    pools: [{ id: 5, name: 'pool-a', is_default: false, permissions: ['edit'] }],
  });

  assert.deepEqual(filtered, {
    schemaVersion: 1,
    machines: [{
      id: 42,
      system_id: 'machine-42',
      hostname: 'server-42',
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
  });
});

test('requires the machine, zone, and pool arrays', () => {
  assert.throws(
    () => filterMaasUiEnrichment({ machines: [], zones: [] }),
    /pools array/
  );
});
