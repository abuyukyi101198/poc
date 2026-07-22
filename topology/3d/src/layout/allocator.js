import {
  TWO_PI, LEVEL_STEP,
  RACK_COLUMNS, RACK_GAP, LEVELS,
  MACHINE_HEIGHT,
  MACHINE_MIN_ARC_WIDTH, MACHINE_MAX_ARC_WIDTH,
  MACHINE_ARC_INSET, MACHINE_H_GAP,
  MACHINE_VERTICAL_INSET, MACHINE_V_GAP,
} from './constants.js';

// ── Height computation ────────────────────────────────────────────────────────
//
// Walks the raw topology (before angular allocation) to derive:
//   rackH  — height of one rack ring, sized for the worst-case machine column
//   floorH — height of the tallest rack stack across all leaves
//   leafH / spineH / ssH — floorH + N × LEVEL_STEP each
//
// "Worst case" = all machines in one angular column (narrowest racks) → most rows.
// This ensures racks never overflow leaves regardless of actual angular widths.

export function computeFloorDimensions(data) {
  let maxMachinesPerRack = 0;
  let maxRackRows        = 0;

  for (const sector of data.sectors) {
    for (const ss of sector.superSpines ?? []) {
      for (const spine of ss.spines ?? []) {
        for (const leaf of spine.leaves ?? []) {
          maxRackRows = Math.max(
            maxRackRows,
            Math.ceil((leaf.racks?.length ?? 0) / RACK_COLUMNS),
          );
          for (const rack of leaf.racks ?? []) {
            maxMachinesPerRack = Math.max(
              maxMachinesPerRack,
              rack.machines?.length ?? 0,
            );
          }
        }
      }
    }
  }

  // Rack height: assume all machines stack in 1 column (worst case)
  const machineRows = Math.max(1, maxMachinesPerRack);
  const rackH = machineRows * MACHINE_HEIGHT
              + (machineRows - 1) * MACHINE_V_GAP
              + 2 * MACHINE_VERTICAL_INSET;

  // Floor height: tallest possible rack stack in any leaf column
  const rackRows = Math.max(1, maxRackRows);
  const floorH   = rackRows * rackH + (rackRows - 1) * RACK_GAP;

  return {
    rack:  rackH,
    leaf:  floorH +     LEVEL_STEP,
    spine: floorH + 2 * LEVEL_STEP,
    ss:    floorH + 3 * LEVEL_STEP,
  };
}

// ── Machine counter ───────────────────────────────────────────────────────────

function countMachines(node) {
  if (node.machines) return node.machines.length;
  const children = node.superSpines ?? node.spines ?? node.leaves ?? node.racks ?? [];
  return children.reduce((s, c) => s + countMachines(c), 0);
}

// ── Angular allocation ────────────────────────────────────────────────────────

function distributeByMachineCount(children, parentStart, parentSweep) {
  if (!children?.length) return;
  const weights = children.map(c => countMachines(c) || 1);
  const totalW  = weights.reduce((s, w) => s + w, 0);
  let cursor    = parentStart;
  children.forEach((child, i) => {
    child._angleStart = cursor;
    child._angleSweep = (weights[i] / totalW) * parentSweep;
    cursor           += child._angleSweep;
  });
}

// ── Rack layout ───────────────────────────────────────────────────────────────
//
// Racks within a leaf are placed in a RACK_COLUMNS × N_rows grid.
// rackH is the computed per-rack height (passed in from computeFloorDimensions).

function allocateRacks(leaf, rackH) {
  const { racks, _angleStart, _angleSweep } = leaf;
  if (!racks?.length) return;
  const cols   = RACK_COLUMNS;
  const rows   = Math.ceil(racks.length / cols);
  const colSw  = _angleSweep / cols;
  const totalH = rows * rackH + (rows - 1) * RACK_GAP;

  racks.forEach((rack, i) => {
    const col        = i % cols;
    const row        = Math.floor(i / cols);
    rack._angleStart = _angleStart + col * colSw;
    rack._angleSweep = colSw;
    rack._yOffset    = -(totalH / 2) + row * (rackH + RACK_GAP) + rackH / 2;
  });
}

// ── Machine layout ────────────────────────────────────────────────────────────

function allocateMachines(rack, rackH) {
  const { machines, _angleStart, _angleSweep, _yOffset } = rack;
  if (!machines?.length) return;

  const R      = LEVELS.RACK.outerRadius;
  const availH = rackH - 2 * MACHINE_VERTICAL_INSET;

  // Maximum rows that fit in the available height with fixed slot height
  const maxRows = Math.max(1,
    Math.floor((availH + MACHINE_V_GAP) / (MACHINE_HEIGHT + MACHINE_V_GAP))
  );

  // Minimum cols needed so ceil(machines / cols) ≤ maxRows
  const minColsForHeight = Math.ceil(machines.length / maxRows);

  // Cols also constrained by arc width (prefer wider slots, so start from 1 and grow)
  const totalArcW   = R * _angleSweep;
  const availW      = totalArcW - 2 * MACHINE_ARC_INSET;
  const maxColsByW  = Math.max(1,
    Math.floor((availW + MACHINE_H_GAP) / (MACHINE_MAX_ARC_WIDTH + MACHINE_H_GAP))
  );

  // Use at least enough cols to avoid vertical overflow, but no more than arc allows
  const cols = Math.max(minColsForHeight, Math.min(maxColsByW, machines.length));

  const machineArcW  = (availW - (cols - 1) * MACHINE_H_GAP) / cols;
  const machineAngW  = machineArcW / R;
  const hGapAngW     = MACHINE_H_GAP / R;
  const arcInsetAngW = MACHINE_ARC_INSET / R;

  const machineH = MACHINE_HEIGHT;
  const rackTop  = _yOffset + rackH / 2;

  machines.forEach((machine, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    machine._angleStart = _angleStart + arcInsetAngW + col * (machineAngW + hGapAngW);
    machine._angleSweep = machineAngW;
    machine._height     = machineH;
    machine._yOffset    = rackTop - MACHINE_VERTICAL_INSET
                          - row * (machineH + MACHINE_V_GAP)
                          - machineH / 2;
  });
}

// ── Tree walk ─────────────────────────────────────────────────────────────────
//
// Returns { heights } alongside mutating data in-place.

export function allocateAngles(data) {
  const heights = computeFloorDimensions(data);

  distributeByMachineCount(data.sectors, 0, TWO_PI);

  for (const sector of data.sectors) {
    distributeByMachineCount(sector.superSpines, sector._angleStart, sector._angleSweep);

    for (const ss of sector.superSpines ?? []) {
      distributeByMachineCount(ss.spines, ss._angleStart, ss._angleSweep);

      for (const spine of ss.spines ?? []) {
        distributeByMachineCount(spine.leaves, spine._angleStart, spine._angleSweep);

        for (const leaf of spine.leaves ?? []) {
          allocateRacks(leaf, heights.rack);
          for (const rack of leaf.racks ?? []) {
            allocateMachines(rack, heights.rack);
          }
        }
      }
    }
  }

  return { data, heights };
}
