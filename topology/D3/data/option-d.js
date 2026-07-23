/**
 * Fixture data — Option D (large multi-pod datacenter, simplified)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option D row.
 *
 * Node ID convention: node-type-NNN (zero-padded 3 digits, sequential within type).
 *   Superspines: superspine-001/002 (data), superspine-003/004 (mgmt)
 *   Spines:      spine-001/002/003 (data), spine-004/005/006 (mgmt)
 *   Leaves:      leaf-001…006 (data access), leaf-007…012 (mgmt access)
 *   Border:      border-leaf-001/002
 *   Racks:       rack-001…010
 *   Servers:     server-001…006 (rack-001), 007…011 (rack-002), 012…019 (rack-003),
 *                020…023 (rack-004), 024…030 (rack-005), 031…035 (rack-006),
 *                036…044 (rack-007), 045…050 (rack-008), 051…060 (rack-009),
 *                061…068 (rack-010)
 *
 * Structure (canonical §4.1/§4.3 ring assignment — Pod is root, Border Leaf
 * is an ordinary R4 sibling of data/mgmt leaves, exactly as in Option C):
 *   - 1 Pod (ring R1, root)
 *   - 4 Super-spines (ring R2 — 2 data, 2 mgmt)
 *   - 6 Spines (ring R3 — 3 data, 3 mgmt)
 *   - 14 Leaves (ring R4 — 6 data access, 6 mgmt access, 2 border leaves)
 *   - 10 Racks (ring R5) / 68 Servers (ring R6)
 *
 * Weight convention (spec §5.2): every rung above the rack level carries the
 * FULL deduplicated downstream server count (68). Border leaves carry nominal
 * weight 2 (no racks served directly).
 */

const RACK_WEIGHTS = { "rack-001": 6, "rack-002": 5, "rack-003": 8, "rack-004": 4, "rack-005": 7, "rack-006": 5, "rack-007": 9, "rack-008": 6, "rack-009": 10, "rack-010": 8 };
const TOTAL_SERVERS = Object.values(RACK_WEIGHTS).reduce((a, b) => a + b, 0); // 35

export const nodes = [
  // ---- R1 Pod (root) ----
  {
    id: "pod-001",
    ring: "R1",
    label: "Pod-001",
    weight: TOTAL_SERVERS,
    plane: "shared",
    leaf_role: "n/a",
    trust_tier: "n/a",
    failure_domain_role: "n/a",
    rack_controller_ids: [],
    availability_zone: "n/a",
    metadata: { role: "pod", description: "Single large-scale leaf-spine pod within a multi-pod datacenter (Option D)." }
  },

  // ---- R2 Super-spine ----
  { id: "superspine-001", ring: "R2", label: "Superspine-001", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },
  { id: "superspine-002", ring: "R2", label: "Superspine-002", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },
  { id: "superspine-003", ring: "R2", label: "Superspine-003", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },
  { id: "superspine-004", ring: "R2", label: "Superspine-004", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },

  // ---- R3 Spine (3 per plane) ----
  { id: "spine-001", ring: "R3", label: "Spine-001", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-002", ring: "R3", label: "Spine-002", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-003", ring: "R3", label: "Spine-003", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-004", ring: "R3", label: "Spine-004", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-005", ring: "R3", label: "Spine-005", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-006", ring: "R3", label: "Spine-006", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },

  // ---- R4 Leaf — data & management access leaves ----
  { id: "leaf-001", ring: "R4", label: "Leaf-001", weight: 11, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002"] } },
  { id: "leaf-002", ring: "R4", label: "Leaf-002", weight: 16, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002", "rack-006"] } },
  { id: "leaf-003", ring: "R4", label: "Leaf-003", weight: 18, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-004", "rack-009"] } },
  { id: "leaf-004", ring: "R4", label: "Leaf-004", weight: 23, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-005", "rack-010"] } },
  { id: "leaf-005", ring: "R4", label: "Leaf-005", weight: 9, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-007"] } },
  { id: "leaf-006", ring: "R4", label: "Leaf-006", weight: 6, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-008"] } },
  { id: "leaf-007", ring: "R4", label: "Leaf-007", weight: 11, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002"] } },
  { id: "leaf-008", ring: "R4", label: "Leaf-008", weight: 16, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002", "rack-006"] } },
  { id: "leaf-009", ring: "R4", label: "Leaf-009", weight: 18, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-004", "rack-009"] } },
  { id: "leaf-010", ring: "R4", label: "Leaf-010", weight: 23, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-005", "rack-010"] } },
  { id: "leaf-011", ring: "R4", label: "Leaf-011", weight: 9, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-007"] } },
  { id: "leaf-012", ring: "R4", label: "Leaf-012", weight: 6, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-008"] } },

  // ---- R4 Leaf — border leaves (ordinary R4 members, spec §4.3/§7.5) ----
  { id: "border-leaf-001", ring: "R4", label: "Border-Leaf-001", weight: 2, plane: "data", leaf_role: "border", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "border_leaf", description: "External/WAN/DCI/service-insertion gateway — ordinary R4 leaf (spec §7.5), peers with R3 spines only." } },
  { id: "border-leaf-002", ring: "R4", label: "Border-Leaf-002", weight: 2, plane: "data", leaf_role: "border", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "border_leaf", description: "External/WAN/DCI/service-insertion gateway — ordinary R4 leaf (spec §7.5), peers with R3 spines only." } },

  // ---- R5 Rack ----
  { id: "rack-001", ring: "R5", label: "Rack-001", weight: 6, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-001", "rc-002"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["leaf-001", "leaf-002"], mgmt_leaves: ["leaf-007", "leaf-008"] } },
  { id: "rack-002", ring: "R5", label: "Rack-002", weight: 5, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-001", "rc-002"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["leaf-001", "leaf-002"], mgmt_leaves: ["leaf-007", "leaf-008"] } },
  { id: "rack-003", ring: "R5", label: "Rack-003", weight: 8, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-003", "rc-004"], availability_zone: "az-2", metadata: { leaf_count: 2, data_leaves: ["leaf-003", "leaf-004"], mgmt_leaves: ["leaf-009", "leaf-010"], note: "Contains GPU/accelerator nodes." } },
  { id: "rack-004", ring: "R5", label: "Rack-004", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof",      rack_controller_ids: ["rc-003", "rc-004"], availability_zone: "az-2", metadata: { leaf_count: 1, data_leaves: ["leaf-003"], mgmt_leaves: ["leaf-009"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-005", ring: "R5", label: "Rack-005", weight: 7, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof",      rack_controller_ids: ["rc-005", "rc-006"], availability_zone: "az-3", metadata: { leaf_count: 1, data_leaves: ["leaf-004"], mgmt_leaves: ["leaf-010"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-006", ring: "R5", label: "Rack-006", weight: 5, plane: "shared", leaf_role: "n/a", trust_tier: "tenant",   failure_domain_role: "spof",      rack_controller_ids: ["rc-001"],             availability_zone: "az-4", metadata: { leaf_count: 1, data_leaves: ["leaf-002"], mgmt_leaves: ["leaf-008"], note: "Single-leaf, tenant-controlled bare-metal servers, single (non-redundant) rack controller." } },
  { id: "rack-007", ring: "R5", label: "Rack-007", weight: 9, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof",      rack_controller_ids: ["rc-001", "rc-002"], availability_zone: "az-1", metadata: { leaf_count: 1, data_leaves: ["leaf-005"], mgmt_leaves: ["leaf-011"] } },
  { id: "rack-008", ring: "R5", label: "Rack-008", weight: 6, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof",      rack_controller_ids: ["rc-007", "rc-008"], availability_zone: "az-2", metadata: { leaf_count: 1, data_leaves: ["leaf-006"], mgmt_leaves: ["leaf-012"] } },
  { id: "rack-009", ring: "R5", label: "Rack-009", weight: 10, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-003", "rc-004"], availability_zone: "az-2", metadata: { leaf_count: 2, data_leaves: ["leaf-003"], mgmt_leaves: ["leaf-009"], note: "High-density compute rack." } },
  { id: "rack-010", ring: "R5", label: "Rack-010", weight: 8, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-005", "rc-006"], availability_zone: "az-3", metadata: { leaf_count: 2, data_leaves: ["leaf-004"], mgmt_leaves: ["leaf-010"] } },

  // ---- R6 Server — rack-001 (6 servers) ----
  { id: "server-001", ring: "R6", label: "Srv-001", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a",  metadata: { rack: "rack-001" } },
  { id: "server-002", ring: "R6", label: "Srv-002", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a",  metadata: { rack: "rack-001" } },
  { id: "server-003", ring: "R6", label: "Srv-003", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a",  metadata: { rack: "rack-001" } },
  { id: "server-004", ring: "R6", label: "Srv-004", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a",  metadata: { rack: "rack-001" } },
  { id: "server-005", ring: "R6", label: "Srv-005", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a",  metadata: { rack: "rack-001" } },
  { id: "server-006", ring: "R6", label: "Srv-006", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-2", metadata: { rack: "rack-001", note: "AZ override — reassigned out of the rack's default az-1 (spec §7.8)." } },

  // ---- R6 Server — rack-002 (5 servers) ----
  { id: "server-007", ring: "R6", label: "Srv-007", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
  { id: "server-008", ring: "R6", label: "Srv-008", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
  { id: "server-009", ring: "R6", label: "Srv-009", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-3", metadata: { rack: "rack-002", note: "AZ override — reassigned to az-3 from rack's default az-1 (spec §7.8)." } },
  { id: "server-010", ring: "R6", label: "Srv-010", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
  { id: "server-011", ring: "R6", label: "Srv-011", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },

  // ---- R6 Server — rack-003 (8 servers, incl. 2 GPU) ----
  { id: "server-012", ring: "R6", label: "Srv-012", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003" } },
  { id: "server-013", ring: "R6", label: "Srv-013", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003" } },
  { id: "server-014", ring: "R6", label: "Srv-014", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003" } },
  { id: "server-015", ring: "R6", label: "Srv-015", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003" } },
  { id: "server-016", ring: "R6", label: "Srv-016", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003" } },
  { id: "server-017", ring: "R6", label: "Srv-017", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003" } },
  { id: "server-018", ring: "R6", label: "Srv-018", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003", node_type: "gpu", accelerators: 4 } },
  { id: "server-019", ring: "R6", label: "Srv-019", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-003", node_type: "gpu", accelerators: 4 } },

  // ---- R6 Server — rack-004 (4 servers) ----
  { id: "server-020", ring: "R6", label: "Srv-020", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-004" } },
  { id: "server-021", ring: "R6", label: "Srv-021", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-004" } },
  { id: "server-022", ring: "R6", label: "Srv-022", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-004" } },
  { id: "server-023", ring: "R6", label: "Srv-023", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-004" } },

  // ---- R6 Server — rack-005 (7 servers) ----
  { id: "server-024", ring: "R6", label: "Srv-024", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-025", ring: "R6", label: "Srv-025", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-026", ring: "R6", label: "Srv-026", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-1", metadata: { rack: "rack-005", note: "AZ override — reassigned to az-1 from rack's default az-3 (spec §7.8)." } },
  { id: "server-027", ring: "R6", label: "Srv-027", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-028", ring: "R6", label: "Srv-028", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-029", ring: "R6", label: "Srv-029", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-030", ring: "R6", label: "Srv-030", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-4", metadata: { rack: "rack-005", note: "AZ override — reassigned to az-4 from rack's default az-3 (spec §7.8)." } },

  // ---- R6 Server — rack-006 (5 servers, tenant) ----
  { id: "server-031", ring: "R6", label: "Srv-031", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-032", ring: "R6", label: "Srv-032", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-033", ring: "R6", label: "Srv-033", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-034", ring: "R6", label: "Srv-034", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-035", ring: "R6", label: "Srv-035", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },

  // ---- R6 Server — rack-007 (9 servers) ----
  { id: "server-036", ring: "R6", label: "Srv-036", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },
  { id: "server-037", ring: "R6", label: "Srv-037", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },
  { id: "server-038", ring: "R6", label: "Srv-038", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-2", metadata: { rack: "rack-007", note: "AZ override — reassigned to az-2 from rack's default az-1 (spec §7.8)." } },
  { id: "server-039", ring: "R6", label: "Srv-039", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },
  { id: "server-040", ring: "R6", label: "Srv-040", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },
  { id: "server-041", ring: "R6", label: "Srv-041", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },
  { id: "server-042", ring: "R6", label: "Srv-042", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },
  { id: "server-043", ring: "R6", label: "Srv-043", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-3", metadata: { rack: "rack-007", note: "AZ override — reassigned to az-3 from rack's default az-1 (spec §7.8)." } },
  { id: "server-044", ring: "R6", label: "Srv-044", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-007" } },

  // ---- R6 Server — rack-008 (6 servers) ----
  { id: "server-045", ring: "R6", label: "Srv-045", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-008" } },
  { id: "server-046", ring: "R6", label: "Srv-046", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-008" } },
  { id: "server-047", ring: "R6", label: "Srv-047", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-008" } },
  { id: "server-048", ring: "R6", label: "Srv-048", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-008" } },
  { id: "server-049", ring: "R6", label: "Srv-049", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-008" } },
  { id: "server-050", ring: "R6", label: "Srv-050", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-008" } },

  // ---- R6 Server — rack-009 (10 servers, high-density) ----
  { id: "server-051", ring: "R6", label: "Srv-051", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-052", ring: "R6", label: "Srv-052", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-053", ring: "R6", label: "Srv-053", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-054", ring: "R6", label: "Srv-054", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-4", metadata: { rack: "rack-009", note: "AZ override — reassigned to az-4 from rack's default az-2 (spec §7.8)." } },
  { id: "server-055", ring: "R6", label: "Srv-055", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-056", ring: "R6", label: "Srv-056", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-057", ring: "R6", label: "Srv-057", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-1", metadata: { rack: "rack-009", note: "AZ override — reassigned to az-1 from rack's default az-2 (spec §7.8)." } },
  { id: "server-058", ring: "R6", label: "Srv-058", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-059", ring: "R6", label: "Srv-059", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },
  { id: "server-060", ring: "R6", label: "Srv-060", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-009" } },

  // ---- R6 Server — rack-010 (8 servers) ----
  { id: "server-061", ring: "R6", label: "Srv-061", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-062", ring: "R6", label: "Srv-062", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-063", ring: "R6", label: "Srv-063", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-064", ring: "R6", label: "Srv-064", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-065", ring: "R6", label: "Srv-065", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-066", ring: "R6", label: "Srv-066", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-067", ring: "R6", label: "Srv-067", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } },
  { id: "server-068", ring: "R6", label: "Srv-068", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-010" } }
];

export const links = [
  // Pod -> Super-spine
  { source: "pod-001", target: "superspine-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-001", target: "superspine-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-001", target: "superspine-003", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "pod-001", target: "superspine-004", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Pod -> Rack (containment)
  { source: "pod-001", target: "rack-001", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-002", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-003", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-004", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-005", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-006", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-007", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-008", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-009", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-010", plane: "shared", type: "containment", weight: 1 },

  // Super-spine <-> Spine (full mesh per plane)
  { source: "superspine-001", target: "spine-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-001", target: "spine-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-001", target: "spine-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-002", target: "spine-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-002", target: "spine-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-002", target: "spine-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-003", target: "spine-004", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-003", target: "spine-005", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-003", target: "spine-006", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-004", target: "spine-004", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-004", target: "spine-005", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-004", target: "spine-006", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Spine <-> Leaf — access leaves (full mesh per plane)
  { source: "spine-001", target: "leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-004", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-005", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-006", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-004", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-005", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-006", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-004", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-005", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-006", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-007", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-008", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-009", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-010", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-011", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-012", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-005", target: "leaf-007", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-005", target: "leaf-008", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-005", target: "leaf-009", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-005", target: "leaf-010", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-005", target: "leaf-011", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-005", target: "leaf-012", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-006", target: "leaf-007", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-006", target: "leaf-008", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-006", target: "leaf-009", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-006", target: "leaf-010", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-006", target: "leaf-011", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-006", target: "leaf-012", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Spine <-> Border Leaf (data plane, full mesh)
  { source: "spine-001", target: "border-leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "border-leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "border-leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "border-leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "border-leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "border-leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },

  // Leaf -> Rack (data plane)
  { source: "leaf-001", target: "rack-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-002", target: "rack-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-001", target: "rack-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-002", target: "rack-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-003", target: "rack-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-004", target: "rack-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-003", target: "rack-004", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-004", target: "rack-005", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-002", target: "rack-006", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-005", target: "rack-007", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-006", target: "rack-008", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-003", target: "rack-009", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-004", target: "rack-010", plane: "data", type: "routing_adjacency", weight: 1 },

  // Leaf -> Rack (mgmt plane)
  { source: "leaf-007", target: "rack-001", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-008", target: "rack-001", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-007", target: "rack-002", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-008", target: "rack-002", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-009", target: "rack-003", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-010", target: "rack-003", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-009", target: "rack-004", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-010", target: "rack-005", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-008", target: "rack-006", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-011", target: "rack-007", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-012", target: "rack-008", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-009", target: "rack-009", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-010", target: "rack-010", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Rack -> Server (containment)
  { source: "rack-001", target: "server-001", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-002", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-003", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-004", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-005", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-006", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-007", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-008", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-009", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-010", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-011", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-012", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-013", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-014", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-015", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-016", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-017", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-018", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-003", target: "server-019", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-004", target: "server-020", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-004", target: "server-021", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-004", target: "server-022", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-004", target: "server-023", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-024", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-025", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-026", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-027", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-028", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-029", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-005", target: "server-030", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-006", target: "server-031", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-006", target: "server-032", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-006", target: "server-033", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-006", target: "server-034", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-006", target: "server-035", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-036", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-037", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-038", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-039", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-040", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-041", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-042", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-043", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-007", target: "server-044", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-008", target: "server-045", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-008", target: "server-046", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-008", target: "server-047", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-008", target: "server-048", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-008", target: "server-049", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-008", target: "server-050", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-051", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-052", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-053", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-054", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-055", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-056", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-057", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-058", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-059", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-009", target: "server-060", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-061", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-062", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-063", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-064", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-065", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-066", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-067", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-010", target: "server-068", plane: "shared", type: "containment", weight: 1 }
];

export const fixtureMeta = {
  option: "D",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  dualLeafRacks: ["rack-001", "rack-002", "rack-003", "rack-009", "rack-010"],
  singleLeafRacks: ["rack-004", "rack-005", "rack-006", "rack-007", "rack-008"],
  borderLeaves: ["border-leaf-001", "border-leaf-002"],
  superspines: ["superspine-001", "superspine-002", "superspine-003", "superspine-004"],
  sharedRackControllerGroups: [
    { controllers: ["rc-001", "rc-002"], racks: ["rack-001", "rack-002", "rack-007"] },
    { controllers: ["rc-003", "rc-004"], racks: ["rack-003", "rack-004", "rack-009"] },
    { controllers: ["rc-005", "rc-006"], racks: ["rack-005", "rack-010"] },
    { controllers: ["rc-007", "rc-008"], racks: ["rack-008"] }
  ],
  azOverrideServers: ["server-006", "server-009", "server-026", "server-030", "server-038", "server-043", "server-054", "server-057"]
};

// §3.3 — Pod occupies R1 (root), identical to Option C.  R2 is the new
// Super-spine tier (absent in C); R3-R6 match global defaults.
export const meta = {
  option: "D",
  label: "Option D",
  title: "Option D · Large Multi-Pod Datacenter",
  subtitle: "Thousands of Servers · Pod Root · Super-spine Tier",
  ringNames: { R2: "Superspine" }
};

