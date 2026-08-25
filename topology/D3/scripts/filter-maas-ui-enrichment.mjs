import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const d3Dir = resolve(scriptDir, '..');
const sourcePath = resolve(d3Dir, 'data', 'lldp', 'tor3_maas-ui.json');
const outputPath = resolve(d3Dir, 'data', 'generated', 'maas', 'tor3-maas-ui-enrichment.json');

function requireArray(value, key) {
  if (!Array.isArray(value)) {
    throw new TypeError(`MAAS UI export must contain a ${key} array.`);
  }
  return value;
}

function compactStorage(value) {
  if (Number.isFinite(value)) return value;
  return Number.isFinite(value?.parsedValue) ? value.parsedValue : null;
}

export function filterMaasUiEnrichment(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('MAAS UI export must be an object.');
  }

  const zones = requireArray(source.zones, 'zones').map(zone => ({
    id: zone.id,
    name: zone.name,
  }));
  const pools = requireArray(source.pools, 'pools').map(pool => ({
    id: pool.id,
    name: pool.name,
    is_default: Boolean(pool.is_default),
  }));
  const machines = requireArray(source.machines, 'machines').map(machine => ({
    id: machine.id,
    system_id: machine.system_id,
    hostname: machine.hostname,
    zone_id: machine.zone?.id ?? null,
    pool_id: machine.pool?.id ?? null,
    status: machine.status,
    power_state: machine.power_state,
    cpu_count: machine.cpu_count,
    memory: machine.memory,
    storage: compactStorage(machine.storage),
    architecture: machine.architecture,
  }));

  return {
    schemaVersion: 1,
    machines,
    zones,
    pools,
  };
}

async function main() {
  let source;
  try {
    source = JSON.parse(await readFile(sourcePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read MAAS UI export at ${sourcePath}: ${error.message}`);
  }

  const enrichment = filterMaasUiEnrichment(source);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(enrichment, null, 2)}\n`);
  console.log(
    `[maas] Wrote ${enrichment.machines.length} machines, ` +
    `${enrichment.zones.length} zones, and ${enrichment.pools.length} pools to ${outputPath}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`[maas] Enrichment filtering failed: ${error.message}`);
    process.exitCode = 1;
  });
}
