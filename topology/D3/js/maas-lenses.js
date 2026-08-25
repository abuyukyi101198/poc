export const MAAS_LENSES = Object.freeze([
  { id: 'none', label: 'Topology' },
  { id: 'tenancy', label: 'Tenancy' },
  { id: 'status', label: 'Lifecycle' },
  { id: 'cpu', label: 'CPU' },
  { id: 'memory', label: 'Memory' },
  { id: 'storage', label: 'Storage' },
]);

export const MAAS_STATUS_OPTIONS = Object.freeze([
  { key: 'allocated', label: 'Allocated' },
  { key: 'broken', label: 'Broken' },
  { key: 'commissioning', label: 'Commissioning' },
  { key: 'deployed', label: 'Deployed' },
  { key: 'deploying', label: 'Deploying' },
  { key: 'disk_erasing', label: 'Disk erasing' },
  { key: 'entering_rescue_mode', label: 'Entering rescue mode' },
  { key: 'exiting_rescue_mode', label: 'Exiting rescue mode' },
  { key: 'failed_commissioning', label: 'Failed commissioning' },
  { key: 'failed_deployment', label: 'Failed deployment' },
  { key: 'failed_disk_erasing', label: 'Failed disk erasing' },
  { key: 'failed_entering_rescue_mode', label: 'Failed to enter rescue mode' },
  { key: 'failed_exiting_rescue_mode', label: 'Failed to exit rescue mode' },
  { key: 'failed_releasing', label: 'Releasing failed' },
  { key: 'failed_testing', label: 'Failed testing' },
  { key: 'missing', label: 'Missing' },
  { key: 'new', label: 'New' },
  { key: 'ready', label: 'Ready' },
  { key: 'releasing', label: 'Releasing' },
  { key: 'rescue_mode', label: 'Rescue mode' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'retired', label: 'Retired' },
  { key: 'testing', label: 'Testing' },
]);

const CAPACITY_FIELDS = new Set(['cpu', 'memory', 'storage']);
const TENANCY_DOMINANCE_THRESHOLD = 0.75;
const STATUS_BY_KEY = new Map(MAAS_STATUS_OPTIONS.map(status => [status.key, status]));
const STATUS_LOOKUP = new Map(
  MAAS_STATUS_OPTIONS.flatMap(status => [
    [status.key, status.key],
    [normalized(status.label), status.key],
  ])
);
const STATUS_ORDER = new Map(MAAS_STATUS_OPTIONS.map((status, index) => [status.key, index]));
const STATUS_COLOR_ORDER = new Map([
  ['attention', 0],
  ['transition', 1],
  ['active', 2],
  ['available', 3],
  ['inactive', 4],
  ['unknown', 5],
  ['unmatched', 6],
]);

function normalized(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function categoryIndex(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 8;
}

function availabilityZoneTone(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `az-${hash % 4}`;
}

function capacityThresholds(values) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((first, second) => first - second);
  return [0.2, 0.4, 0.6, 0.8].map(quantile => {
    const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile));
    return sorted[index];
  });
}

function createSummary(id) {
  return {
    id,
    endpoints: 0,
    matched: 0,
    unmatched: 0,
    statusCounts: new Map(),
    poolCounts: new Map(),
    capacity: { cpu: 0, memory: 0, storage: 0 },
    capacityValues: { cpu: [], memory: [], storage: [] },
  };
}

function addEndpoint(summary, node, status) {
  const maas = node.metadata?.maas;
  summary.endpoints += 1;
  increment(summary.statusCounts, status);
  if (!maas) {
    summary.unmatched += 1;
    return;
  }

  summary.matched += 1;
  increment(summary.poolCounts, maas.pool?.name || 'Unassigned');
  for (const field of CAPACITY_FIELDS) {
    const key = field === 'cpu' ? 'cpuCount' : field;
    if (Number.isFinite(maas[key])) {
      summary.capacity[field] += maas[key];
      summary.capacityValues[field].push(maas[key]);
    }
  }
}

export function maasStatusKey(value) {
  return STATUS_LOOKUP.get(normalized(value)) ?? 'unknown';
}

export function maasStatusColorGroup(status) {
  if (status === 'unmatched') return 'unmatched';
  if (status === 'unknown') return 'unknown';
  if (status === 'broken' || status.startsWith('failed_')) return 'attention';
  if (['commissioning', 'deploying', 'disk_erasing', 'entering_rescue_mode', 'exiting_rescue_mode', 'releasing', 'testing'].includes(status)) return 'transition';
  if (['allocated', 'deployed', 'reserved', 'rescue_mode'].includes(status)) return 'active';
  if (['new', 'ready'].includes(status)) return 'available';
  return 'inactive';
}

export function maasStatusLabel(status) {
  if (status === 'unmatched') return 'Unmatched';
  return STATUS_BY_KEY.get(status)?.label ?? 'Unknown';
}

export function createMaasModel(nodes) {
  const endpointNodes = nodes.filter(node => node.ring === 'R6');
  const endpointsById = new Map();
  const rackSummaries = new Map(
    nodes.filter(node => node.ring === 'R5').map(node => [node.id, createSummary(node.id)])
  );
  const groupSummaries = new Map();
  const poolCounts = new Map();
  const statusCounts = new Map();
  const availabilityZoneCounts = new Map();
  const capacityValues = { cpu: [], memory: [], storage: [] };
  const coverage = { endpoints: endpointNodes.length, matched: 0, unmatched: 0 };

  for (const node of endpointNodes) {
    const maas = node.metadata?.maas;
    const status = maas ? maasStatusKey(maas.status) : 'unmatched';
    endpointsById.set(node.id, { maas, status, colorGroup: maasStatusColorGroup(status) });
    increment(statusCounts, status);
    if (node.availability_zone && node.availability_zone !== 'n/a') {
      increment(availabilityZoneCounts, node.availability_zone);
    }
    if (maas) coverage.matched += 1;
    else coverage.unmatched += 1;

    const rackId = node.metadata?.rack;
    if (rackId && !rackSummaries.has(rackId)) rackSummaries.set(rackId, createSummary(rackId));
    const groupId = node.metadata?.stackGroup;
    if (groupId && !groupSummaries.has(groupId)) groupSummaries.set(groupId, createSummary(groupId));

    if (rackId) addEndpoint(rackSummaries.get(rackId), node, status);
    if (groupId) addEndpoint(groupSummaries.get(groupId), node, status);
    if (!maas) continue;

    increment(poolCounts, maas.pool?.name || 'Unassigned');
    for (const field of CAPACITY_FIELDS) {
      const key = field === 'cpu' ? 'cpuCount' : field;
      if (Number.isFinite(maas[key])) capacityValues[field].push(maas[key]);
    }
  }

  return {
    coverage,
    endpointsById,
    rackSummaries,
    groupSummaries,
    poolCounts,
    statusCounts,
    availabilityZoneCounts,
    capacityThresholds: Object.fromEntries(
      Object.entries(capacityValues).map(([field, values]) => [field, capacityThresholds(values)])
    ),
  };
}

export function maasSearchTerms(node) {
  const maas = node.metadata?.maas;
  if (!maas) return [];
  return [
    maas.systemId,
    maas.hostname,
    maas.zone?.name,
    maas.pool?.name,
    maas.status,
    maas.powerState,
    maas.architecture,
  ].filter(Boolean);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function capacityFill(value, lens, model) {
  if (!Number.isFinite(value)) return { tone: 'unmatched', label: 'MAAS value unavailable' };
  const bin = model.capacityThresholds[lens].findIndex(threshold => value <= threshold);
  return {
    tone: `capacity-${bin < 0 ? 4 : bin}`,
    label: `${lens} capacity band ${bin < 0 ? 5 : bin + 1}`,
  };
}

function lifecycleRackGroup(summary) {
  const countGroup = group => [...summary.statusCounts.entries()]
    .filter(([status]) => maasStatusColorGroup(status) === group)
    .reduce((total, [, count]) => total + count, 0);
  if (countGroup('attention') > 0) return 'attention';
  if (countGroup('transition') > 0) return 'transition';
  const active = countGroup('active');
  const available = countGroup('available');
  if (active || available) return active >= available ? 'active' : 'available';
  if (countGroup('inactive') > 0) return 'inactive';
  if (countGroup('unknown') > 0) return 'unknown';
  return 'unmatched';
}

export function maasServerFill(node, lens, model) {
  if (lens === 'none' || node.ring !== 'R6') return null;
  const detail = model.endpointsById.get(node.id);
  if (!detail?.maas) return { tone: 'unmatched', label: 'MAAS unmatched' };

  if (lens === 'status') {
    return { tone: `status-${detail.colorGroup}`, label: maasStatusLabel(detail.status) };
  }
  if (CAPACITY_FIELDS.has(lens)) {
    const key = lens === 'cpu' ? 'cpuCount' : lens;
    return capacityFill(detail.maas[key], lens, model);
  }
  if (lens === 'tenancy') {
    const value = detail.maas.pool?.name || 'Unassigned';
    return { tone: `category-${categoryIndex(value)}`, label: value };
  }
  return null;
}

export function maasRackFill(rack, lens, model) {
  if (lens === 'none' || rack.ring !== 'R5') return null;
  const summary = model.rackSummaries.get(rack.id);
  if (!summary?.endpoints) return null;

  if (lens === 'status') {
    const group = lifecycleRackGroup(summary);
    const label = {
      attention: 'Failed/broken',
      transition: 'Transitioning',
      active: 'Active',
      available: 'Ready/new',
      inactive: 'Inactive',
      unknown: 'Unknown',
      unmatched: 'Unmatched',
    }[group];
    return { tone: `status-${group}`, label, group };
  }
  if (CAPACITY_FIELDS.has(lens)) {
    const value = median(summary.capacityValues[lens]);
    return capacityFill(value, lens, model);
  }
  if (lens === 'tenancy') {
    const rankedPools = [...summary.poolCounts.entries()]
      .sort(([firstName, firstCount], [secondName, secondCount]) =>
        secondCount - firstCount || firstName.localeCompare(secondName));
    const [pool, count] = rankedPools[0] ?? [];
    if (!pool || count / summary.matched < TENANCY_DOMINANCE_THRESHOLD) {
      return { tone: 'mixed', label: 'Mixed tenancy' };
    }
    return { tone: `category-${categoryIndex(pool)}`, label: pool };
  }
  return null;
}

export function lensLegend(lens, model) {
  if (lens === 'none') {
    const zones = [...model.availabilityZoneCounts.keys()].sort();
    return zones.length
      ? zones.map(zone => ({ tone: availabilityZoneTone(zone), label: zone }))
      : [{ tone: 'unmatched', label: 'Availability zones unavailable' }];
  }
  if (lens === 'status') {
    return [...model.statusCounts.keys()]
      .sort((first, second) => {
        const groupDifference = (STATUS_COLOR_ORDER.get(maasStatusColorGroup(first)) ?? Infinity) -
          (STATUS_COLOR_ORDER.get(maasStatusColorGroup(second)) ?? Infinity);
        if (groupDifference !== 0) return groupDifference;
        const optionDifference = (STATUS_ORDER.get(first) ?? Infinity) - (STATUS_ORDER.get(second) ?? Infinity);
        return optionDifference || maasStatusLabel(first).localeCompare(maasStatusLabel(second));
      })
      .map(status => ({
        tone: `status-${maasStatusColorGroup(status)}`,
        label: maasStatusLabel(status),
      }));
  }
  if (CAPACITY_FIELDS.has(lens)) {
    return ['Lowest', 'Low', 'Medium', 'High', 'Highest'].map((label, index) => ({
      tone: `capacity-${index}`,
      label,
    }));
  }
  return [...model.poolCounts.keys()].sort().map(value => ({
    tone: `category-${categoryIndex(value)}`,
    label: value,
  }));
}
