export const TWO_PI = Math.PI * 2;

// Radii for each hierarchy level (center → outer edge).
// Heights are NOT stored here — they are computed dynamically from machine counts
// by computeFloorDimensions() in allocator.js.
export const LEVELS = {
  SUPER_SPINE: { radius:      0.5                              },
  SPINE:       { outerRadius: 1.0,   innerRadius: 0.502       },
  LEAF:        { outerRadius: 1.5,   innerRadius: 1.002       },
  RACK:        { outerRadius: 2.5,  innerRadius: 1.502       },
};

// Each level is this many world-units taller than the level outside it.
export const LEVEL_STEP = 0.04;

// Racks within a leaf are arranged in a RACK_COLUMNS × N_rows grid.
// Columns subdivide the leaf's angular range; rows stack vertically.
export const RACK_COLUMNS = 2;
export const RACK_GAP     = 0.02;   // world-unit vertical gap between rack rows

// Machine slots sit as shallow protrusions on the outer surface of each rack.
// Column count is computed via flex-wrap: pack as many columns as fit at
// MACHINE_MAX_ARC_WIDTH; never make a column narrower than MACHINE_MIN_ARC_WIDTH.
// Machines are placed left-to-right, top-to-bottom from the rack's top-left corner.
export const MACHINE_PROTRUSION     = 0.025;  // radial depth above rack outer surface
export const MACHINE_HEIGHT         = 0.05;   // fixed height per machine slot (like a rack unit)
export const MACHINE_MIN_ARC_WIDTH  = 0.10;   // world-units — minimum arc width per machine
export const MACHINE_MAX_ARC_WIDTH  = 0.26;   // world-units — maximum arc width per machine
export const MACHINE_ARC_INSET      = 0.015;  // world-units — gap from rack arc edge (each side)
export const MACHINE_H_GAP          = 0.010;  // world-units — horizontal gap between machines
export const MACHINE_VERTICAL_INSET = 0.015;  // world-units — gap from rack top/bottom
export const MACHINE_V_GAP          = 0.010;  // world-units — vertical gap between machine rows
