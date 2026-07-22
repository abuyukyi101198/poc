// Sample topology data for one floor.
//
// Hierarchy: sectors → superSpines → spines → leaves → racks → machines
//
// No explicit angleSweep values — the allocator derives every slice width
// proportionally from the number of descendant machines.
//
// Two super-spines with different subtree sizes create natural visual weight:
//   SS-A (heavier): 3 spines, 7 leaves, 28 racks, 112 machines
//   SS-B (lighter): 2 spines, 3 leaves, 14 racks,  56 machines

function makeMachines(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `m-${i}` }));
}

function makeRacks(counts, machinesEach = 4) {
  const arr = typeof counts === 'number'
    ? Array(counts).fill(machinesEach)
    : counts;
  return arr.map((mc, i) => ({ id: `rack-${i}`, machines: makeMachines(mc) }));
}

export const topologyData = {
  id: 'floor-1',
  sectors: [
    {
      id: 'sector-A', label: 'S01',
      superSpines: [{
        id: 'ss-A',
        spines: [
          {
            id: 'spine-A1',
            leaves: [
              { id: 'leaf-A1a', racks: makeRacks(6) },   // 2 cols × 3 rows
              { id: 'leaf-A1b', racks: makeRacks(4) },   // 2 cols × 2 rows
            ],
          },
          {
            id: 'spine-A2',
            leaves: [
              { id: 'leaf-A2a', racks: makeRacks(4) },
              { id: 'leaf-A2b', racks: makeRacks(6) },
              { id: 'leaf-A2c', racks: makeRacks(2) },   // 2 cols × 1 row
            ],
          },
          {
            id: 'spine-A3',
            leaves: [
              { id: 'leaf-A3a', racks: makeRacks(4) },
              { id: 'leaf-A3b', racks: makeRacks(2) },
            ],
          },
        ],
      }],
    },
    {
      id: 'sector-B', label: 'S02',
      superSpines: [{
        id: 'ss-B',
        spines: [
          {
            id: 'spine-B1',
            leaves: [
              { id: 'leaf-B1a', racks: makeRacks(6) },
              { id: 'leaf-B1b', racks: makeRacks(4) },
            ],
          },
          {
            id: 'spine-B2',
            leaves: [
              { id: 'leaf-B2a', racks: makeRacks(4) },
            ],
          },
        ],
      }],
    },
  ],
};
