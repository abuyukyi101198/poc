/**
 * Fixture data — Option C (standard leaf-spine datacenter pod)
 *
 * Companion to: radial-layered-topology-viz-spec.md (schema: §9.1, §3.3 Option C row)
 *
 * Node ID convention: node-type-NNN (zero-padded 3 digits, sequential within type).
 *   Spines:      spine-001/002 (data), spine-003/004 (mgmt)
 *   Leaves:      leaf-001…004 (data access), leaf-005…008 (mgmt access)
 *   Border:      border-leaf-001/002
 *   Racks:       rack-001…006
 *   Servers:     server-001…006 (rack-001), 007…011 (rack-002), 012…019 (rack-003),
 *                020…023 (rack-004), 024…030 (rack-005), 031…035 (rack-006)
 *
 * Weight = deduplicated downstream server count (spec §5.2):
 *   rack-001=6, rack-002=5, rack-003=8, rack-004=4, rack-005=7, rack-006=5 (=35 total)
 *   leaf-001 → racks 001,002        → 6+5=11
 *   leaf-002 → racks 001,002,006    → 6+5+5=16
 *   leaf-003 → racks 003,004        → 8+4=12
 *   leaf-004 → racks 003,005        → 8+7=15
 *   leaf-005…008 mirror leaf-001…004 rack assignments
 *   border-leaf-001/002 → no racks (external/WAN role) → nominal weight 2
 *   spine-001…004, pod-001 → all racks → 35
 */

export const nodes = [
  // ---- R1 Pod ----
  {
    id: "pod-001",
    ring: "R1",
    label: "Pod-001",
    weight: 35,
    plane: "shared",
    leaf_role: "n/a",
    trust_tier: "n/a",
    failure_domain_role: "n/a",
    rack_controller_ids: [],
    availability_zone: "n/a",
    metadata: { role: "pod", description: "Single standard leaf-spine pod (Option C)." }
  },

  // ---- R3 Tier-2 / Spine ----
  { id: "spine-001", ring: "R3", label: "Spine-001", weight: 35, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-002", ring: "R3", label: "Spine-002", weight: 35, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-003", ring: "R3", label: "Spine-003", weight: 35, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-004", ring: "R3", label: "Spine-004", weight: 35, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },

  // ---- R4 Tier-3 / Leaf — data & management access leaves ----
  { id: "leaf-001", ring: "R4", label: "Leaf-001", weight: 11, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002"] } },
  { id: "leaf-002", ring: "R4", label: "Leaf-002", weight: 16, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002", "rack-006"] } },
  { id: "leaf-003", ring: "R4", label: "Leaf-003", weight: 12, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-004"] } },
  { id: "leaf-004", ring: "R4", label: "Leaf-004", weight: 15, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-005"] } },

  { id: "leaf-005", ring: "R4", label: "Leaf-005", weight: 11, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002"] } },
  { id: "leaf-006", ring: "R4", label: "Leaf-006", weight: 16, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-001", "rack-002", "rack-006"] } },
  { id: "leaf-007", ring: "R4", label: "Leaf-007", weight: 12, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-004"] } },
  { id: "leaf-008", ring: "R4", label: "Leaf-008", weight: 15, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-003", "rack-005"] } },

  // ---- R4 Tier-3 / Leaf — border leaves (ordinary R4 members, spec §4.3/§7.5) ----
  { id: "border-leaf-001", ring: "R4", label: "Border-Leaf-001", weight: 2, plane: "data", leaf_role: "border", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "border_leaf", description: "External/WAN/DCI connectivity — ordinary R4 leaf, distinguished only by leaf_role (spec §7.5)." } },
  { id: "border-leaf-002", ring: "R4", label: "Border-Leaf-002", weight: 2, plane: "data", leaf_role: "border", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "border_leaf", description: "External/WAN/DCI connectivity — ordinary R4 leaf, distinguished only by leaf_role (spec §7.5)." } },

  // ---- R5 Rack ----
  { id: "rack-001", ring: "R5", label: "Rack-001", weight: 6, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-001", "rc-002"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["leaf-001", "leaf-002"], mgmt_leaves: ["leaf-005", "leaf-006"] } },
  { id: "rack-002", ring: "R5", label: "Rack-002", weight: 5, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-001", "rc-002"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["leaf-001", "leaf-002"], mgmt_leaves: ["leaf-005", "leaf-006"] } },
  { id: "rack-003", ring: "R5", label: "Rack-003", weight: 8, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-003", "rc-004"], availability_zone: "az-2", metadata: { leaf_count: 2, data_leaves: ["leaf-003", "leaf-004"], mgmt_leaves: ["leaf-007", "leaf-008"], note: "Contains GPU/accelerator nodes." } },
  { id: "rack-004", ring: "R5", label: "Rack-004", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof",      rack_controller_ids: ["rc-003", "rc-004"], availability_zone: "az-2", metadata: { leaf_count: 1, data_leaves: ["leaf-003"], mgmt_leaves: ["leaf-007"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-005", ring: "R5", label: "Rack-005", weight: 7, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof",      rack_controller_ids: ["rc-005", "rc-006"], availability_zone: "az-3", metadata: { leaf_count: 1, data_leaves: ["leaf-004"], mgmt_leaves: ["leaf-008"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-006", ring: "R5", label: "Rack-006", weight: 5, plane: "shared", leaf_role: "n/a", trust_tier: "tenant",   failure_domain_role: "spof",      rack_controller_ids: ["rc-001"],             availability_zone: "az-4", metadata: { leaf_count: 1, data_leaves: ["leaf-002"], mgmt_leaves: ["leaf-006"], note: "Single-leaf, tenant-controlled bare-metal servers, and single (non-redundant) rack controller." } },

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
  { id: "server-009", ring: "R6", label: "Srv-009", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
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
  { id: "server-026", ring: "R6", label: "Srv-026", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-027", ring: "R6", label: "Srv-027", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-028", ring: "R6", label: "Srv-028", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-029", ring: "R6", label: "Srv-029", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },
  { id: "server-030", ring: "R6", label: "Srv-030", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-005" } },

  // ---- R6 Server — rack-006 (5 servers, tenant) ----
  { id: "server-031", ring: "R6", label: "Srv-031", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-032", ring: "R6", label: "Srv-032", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-033", ring: "R6", label: "Srv-033", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-034", ring: "R6", label: "Srv-034", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } },
  { id: "server-035", ring: "R6", label: "Srv-035", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-006" } }
];

export const links = [
  { source: "pod-001", target: "rack-001", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-002", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-003", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-004", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-005", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-001", target: "rack-006", plane: "shared", type: "containment", weight: 1 },

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

  // Pod -> Spine (routing_adjacency)
  { source: "pod-001", target: "spine-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-001", target: "spine-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-001", target: "spine-003", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "pod-001", target: "spine-004", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Spine -> Leaf (data plane, full mesh)
  { source: "spine-001", target: "leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "leaf-004", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-003", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "leaf-004", plane: "data", type: "routing_adjacency", weight: 1 },

  // Spine -> Border Leaf (data plane)
  { source: "spine-001", target: "border-leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-001", target: "border-leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "border-leaf-001", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-002", target: "border-leaf-002", plane: "data", type: "routing_adjacency", weight: 1 },

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

  // Spine -> Leaf (mgmt plane, full mesh)
  { source: "spine-003", target: "leaf-005", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-006", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-007", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-003", target: "leaf-008", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-005", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-006", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-007", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-004", target: "leaf-008", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Leaf -> Rack (mgmt plane)
  { source: "leaf-005", target: "rack-001", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-006", target: "rack-001", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-005", target: "rack-002", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-006", target: "rack-002", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-007", target: "rack-003", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-008", target: "rack-003", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-007", target: "rack-004", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-008", target: "rack-005", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-006", target: "rack-006", plane: "mgmt", type: "routing_adjacency", weight: 1 }
];

export const fixtureMeta = {
  option: "C",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  dualLeafRacks: ["rack-001", "rack-002", "rack-003"],
  singleLeafRacks: ["rack-004", "rack-005", "rack-006"],
  borderLeaves: ["border-leaf-001", "border-leaf-002"],
  sharedRackControllerGroups: [
    { controllers: ["rc-001", "rc-002"], racks: ["rack-001", "rack-002"] },
    { controllers: ["rc-003", "rc-004"], racks: ["rack-003", "rack-004"] }
  ],
  azOverrideServer: "server-006"
};

export const meta = {
  option: "C",
  label: "Option C",
  title: "Option C · Standard Leaf-Spine Pod",
  subtitle: "32–1,000+ Servers · Full Data/Management Clos Fabric",
  ringNames: {}
};

