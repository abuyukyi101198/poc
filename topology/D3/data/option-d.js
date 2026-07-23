/**
 * Fixture data — Option D (large multi-pod datacenter, simplified)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option D row.
 *
 * Structure (canonical §4.1/§4.3 ring assignment — Pod is root, Border Leaf
 * is an ordinary R4 sibling of data/mgmt leaves, exactly as in Option C):
 *   - 1 Pod (ring R1, root — same role as Option C)
 *   - 4 Super-spines (ring R2 — 2 data, 2 mgmt; the inter-pod/datacenter core
 *     layer absent in Option C, connecting spines upward to the pod root and
 *     outward to border leaves)
 *   - 6 Spines (ring R3 — 3 data, 3 mgmt; one more per plane than Option C to
 *     visually distinguish the larger-scale repeated Spine 1..m pattern)
 *   - 10 Leaves (ring R4 — 4 data access, 4 mgmt access, 2 border leaves;
 *     border leaves are ordinary R4 members distinguished by leaf_role:"border",
 *     per spec §4.3/§7.5 — same placement as Option C)
 *   - 6 Racks (ring R5) / 35 Servers (ring R6) — same dual/single-leaf rack
 *     shape, weights, AZ and MAAS-controller flavor as Option C's fixture,
 *     renamed with a -d suffix to avoid id collisions.
 *
 * Option D border leaves follow the same link pattern as Option C: they peer
 * with their adjacent inner ring (R3 Spine) only, via the Spine→BorderLeaf
 * full-mesh links below.  The super-spine tier (R2) connects to spines (R3),
 * not directly to border leaves — there is no R2→R4 skip-ring link.
 *
 * Weight convention (matches Option C precedent, spec §5.2): every rung
 * above the rack level carries the FULL deduplicated downstream server count
 * (35) — e.g. all Super-spines and the Pod carry weight 35.  Border leaves
 * serve no racks directly (external/WAN/DCI role) so they carry a nominal
 * weight of 2, identical to Option C.
 */

const RACK_WEIGHTS = { "rack-d1": 6, "rack-d2": 5, "rack-d3": 8, "rack-d4": 4, "rack-d5": 7, "rack-d6": 5 };
const TOTAL_SERVERS = Object.values(RACK_WEIGHTS).reduce((a, b) => a + b, 0); // 35

export const nodes = [
  // ---- R1 Pod (root — same role as Option C) ----
  {
    id: "pod-d1",
    ring: "R1",
    label: "Pod 1",
    weight: TOTAL_SERVERS,
    plane: "shared",
    leaf_role: "n/a",
    trust_tier: "n/a",
    failure_domain_role: "n/a",
    rack_controller_ids: [],
    availability_zone: "n/a",
    metadata: { role: "pod", description: "Single large-scale leaf-spine pod within a multi-pod datacenter (Option D)." }
  },

  // ---- R2 Super-spine (datacenter core / inter-pod layer — absent in Option C) ----
  { id: "superspine-data-1", ring: "R2", label: "Data Superspine 1", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },
  { id: "superspine-data-2", ring: "R2", label: "Data Superspine 2", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },
  { id: "superspine-mgmt-1", ring: "R2", label: "Mgmt Superspine 1", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },
  { id: "superspine-mgmt-2", ring: "R2", label: "Mgmt Superspine 2", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "superspine" } },

  // ---- R3 Spine (3 per plane — one more than Option C to show scale) ----
  { id: "spine-data-d1", ring: "R3", label: "Data Spine 1", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-data-d2", ring: "R3", label: "Data Spine 2", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-data-d3", ring: "R3", label: "Data Spine 3", weight: TOTAL_SERVERS, plane: "data", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-mgmt-d1", ring: "R3", label: "Mgmt Spine 1", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-mgmt-d2", ring: "R3", label: "Mgmt Spine 2", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },
  { id: "spine-mgmt-d3", ring: "R3", label: "Mgmt Spine 3", weight: TOTAL_SERVERS, plane: "mgmt", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "spine" } },

  // ---- R4 Leaf — data & management access leaves ----
  { id: "leaf-data-d1", ring: "R4", label: "Data Leaf 1", weight: 11, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d1", "rack-d2"] } },
  { id: "leaf-data-d2", ring: "R4", label: "Data Leaf 2", weight: 16, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d1", "rack-d2", "rack-d6"] } },
  { id: "leaf-data-d3", ring: "R4", label: "Data Leaf 3", weight: 12, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d3", "rack-d4"] } },
  { id: "leaf-data-d4", ring: "R4", label: "Data Leaf 4", weight: 15, plane: "data", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d3", "rack-d5"] } },
  { id: "leaf-mgmt-d1", ring: "R4", label: "Mgmt Leaf 1", weight: 11, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d1", "rack-d2"] } },
  { id: "leaf-mgmt-d2", ring: "R4", label: "Mgmt Leaf 2", weight: 16, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d1", "rack-d2", "rack-d6"] } },
  { id: "leaf-mgmt-d3", ring: "R4", label: "Mgmt Leaf 3", weight: 12, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d3", "rack-d4"] } },
  { id: "leaf-mgmt-d4", ring: "R4", label: "Mgmt Leaf 4", weight: 15, plane: "mgmt", leaf_role: "access", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "leaf", serves_racks: ["rack-d3", "rack-d5"] } },

  // ---- R4 Leaf — border leaves (ordinary R4 members, spec §4.3/§7.5) ----
  // In Option D these peer upward to spines (R3), exactly as in Option C.
  // The super-spine tier (R2) does NOT connect directly to border leaves.
  { id: "border-leaf-d1", ring: "R4", label: "Border Leaf 1", weight: 2, plane: "data", leaf_role: "border", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "border_leaf", description: "External/WAN/DCI/service-insertion gateway — ordinary R4 leaf (spec §7.5), peers with R3 spines only." } },
  { id: "border-leaf-d2", ring: "R4", label: "Border Leaf 2", weight: 2, plane: "data", leaf_role: "border", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { role: "border_leaf", description: "External/WAN/DCI/service-insertion gateway — ordinary R4 leaf (spec §7.5), peers with R3 spines only." } },

  // ---- R5 Rack (same shape/weights/AZ/controller flavor as Option C) ----
  { id: "rack-d1", ring: "R5", label: "Rack 1", weight: 6, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-d1a", "rc-d1b"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["leaf-data-d1", "leaf-data-d2"], mgmt_leaves: ["leaf-mgmt-d1", "leaf-mgmt-d2"] } },
  { id: "rack-d2", ring: "R5", label: "Rack 2", weight: 5, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-d1a", "rc-d1b"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["leaf-data-d1", "leaf-data-d2"], mgmt_leaves: ["leaf-mgmt-d1", "leaf-mgmt-d2"] } },
  { id: "rack-d3", ring: "R5", label: "Rack 3", weight: 8, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-d3a", "rc-d3b"], availability_zone: "az-2", metadata: { leaf_count: 2, data_leaves: ["leaf-data-d3", "leaf-data-d4"], mgmt_leaves: ["leaf-mgmt-d3", "leaf-mgmt-d4"], note: "Contains GPU/accelerator nodes." } },
  { id: "rack-d4", ring: "R5", label: "Rack 4", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof", rack_controller_ids: ["rc-d3a", "rc-d3b"], availability_zone: "az-2", metadata: { leaf_count: 1, data_leaves: ["leaf-data-d3"], mgmt_leaves: ["leaf-mgmt-d3"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-d5", ring: "R5", label: "Rack 5", weight: 7, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "spof", rack_controller_ids: ["rc-d5a", "rc-d5b"], availability_zone: "az-3", metadata: { leaf_count: 1, data_leaves: ["leaf-data-d4"], mgmt_leaves: ["leaf-mgmt-d4"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-d6", ring: "R5", label: "Rack 6", weight: 5, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "spof", rack_controller_ids: ["rc-d1a"], availability_zone: "az-4", metadata: { leaf_count: 1, data_leaves: ["leaf-data-d2"], mgmt_leaves: ["leaf-mgmt-d2"], note: "Single-leaf, tenant-controlled bare-metal servers, single (non-redundant) rack controller." } },

  // ---- R6 Server ----
  { id: "server-d1-01", ring: "R6", label: "Rack1-Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d1" } },
  { id: "server-d1-02", ring: "R6", label: "Rack1-Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d1" } },
  { id: "server-d1-03", ring: "R6", label: "Rack1-Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d1" } },
  { id: "server-d1-04", ring: "R6", label: "Rack1-Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d1" } },
  { id: "server-d1-05", ring: "R6", label: "Rack1-Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d1" } },
  { id: "server-d1-06", ring: "R6", label: "Rack1-Srv06", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "az-2", metadata: { rack: "rack-d1", note: "AZ override — reassigned out of the rack's default az-1 (spec §7.8)." } },

  { id: "server-d2-01", ring: "R6", label: "Rack2-Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d2" } },
  { id: "server-d2-02", ring: "R6", label: "Rack2-Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d2" } },
  { id: "server-d2-03", ring: "R6", label: "Rack2-Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d2" } },
  { id: "server-d2-04", ring: "R6", label: "Rack2-Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d2" } },
  { id: "server-d2-05", ring: "R6", label: "Rack2-Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d2" } },

  { id: "server-d3-01", ring: "R6", label: "Rack3-Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3" } },
  { id: "server-d3-02", ring: "R6", label: "Rack3-Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3" } },
  { id: "server-d3-03", ring: "R6", label: "Rack3-Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3" } },
  { id: "server-d3-04", ring: "R6", label: "Rack3-Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3" } },
  { id: "server-d3-05", ring: "R6", label: "Rack3-Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3" } },
  { id: "server-d3-06", ring: "R6", label: "Rack3-Srv06", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3" } },
  { id: "server-d3-07-gpu", ring: "R6", label: "Rack3-GPU07", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3", node_type: "gpu", accelerators: 4 } },
  { id: "server-d3-08-gpu", ring: "R6", label: "Rack3-GPU08", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d3", node_type: "gpu", accelerators: 4 } },

  { id: "server-d4-01", ring: "R6", label: "Rack4-Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d4" } },
  { id: "server-d4-02", ring: "R6", label: "Rack4-Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d4" } },
  { id: "server-d4-03", ring: "R6", label: "Rack4-Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d4" } },
  { id: "server-d4-04", ring: "R6", label: "Rack4-Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d4" } },

  { id: "server-d5-01", ring: "R6", label: "Rack5-Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },
  { id: "server-d5-02", ring: "R6", label: "Rack5-Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },
  { id: "server-d5-03", ring: "R6", label: "Rack5-Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },
  { id: "server-d5-04", ring: "R6", label: "Rack5-Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },
  { id: "server-d5-05", ring: "R6", label: "Rack5-Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },
  { id: "server-d5-06", ring: "R6", label: "Rack5-Srv06", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },
  { id: "server-d5-07", ring: "R6", label: "Rack5-Srv07", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d5" } },

  { id: "server-d6-01", ring: "R6", label: "Rack6-Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d6" } },
  { id: "server-d6-02", ring: "R6", label: "Rack6-Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d6" } },
  { id: "server-d6-03", ring: "R6", label: "Rack6-Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d6" } },
  { id: "server-d6-04", ring: "R6", label: "Rack6-Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d6" } },
  { id: "server-d6-05", ring: "R6", label: "Rack6-Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-d6" } }
];

export const links = [
  // Pod -> Super-spine (routing_adjacency, both planes — Pod is the R1 root
  // that anchors the whole pod; super-spines are its direct R2 children)
  { source: "pod-d1", target: "superspine-data-1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-d1", target: "superspine-data-2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-d1", target: "superspine-mgmt-1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "pod-d1", target: "superspine-mgmt-2", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Pod -> Rack (containment — same pattern as Option C pod-1 -> rack-*)
  { source: "pod-d1", target: "rack-d1", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-d1", target: "rack-d2", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-d1", target: "rack-d3", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-d1", target: "rack-d4", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-d1", target: "rack-d5", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-d1", target: "rack-d6", plane: "shared", type: "containment", weight: 1 },

  // Super-spine <-> Spine (full mesh per plane)
  { source: "superspine-data-1", target: "spine-data-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-data-1", target: "spine-data-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-data-1", target: "spine-data-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-data-2", target: "spine-data-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-data-2", target: "spine-data-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-data-2", target: "spine-data-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "superspine-mgmt-1", target: "spine-mgmt-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-mgmt-1", target: "spine-mgmt-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-mgmt-1", target: "spine-mgmt-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-mgmt-2", target: "spine-mgmt-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-mgmt-2", target: "spine-mgmt-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "superspine-mgmt-2", target: "spine-mgmt-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },


  // Spine <-> Leaf — access leaves (full mesh per plane)
  { source: "spine-data-d1", target: "leaf-data-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d1", target: "leaf-data-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d1", target: "leaf-data-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d1", target: "leaf-data-d4", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d2", target: "leaf-data-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d2", target: "leaf-data-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d2", target: "leaf-data-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d2", target: "leaf-data-d4", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d3", target: "leaf-data-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d3", target: "leaf-data-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d3", target: "leaf-data-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d3", target: "leaf-data-d4", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d1", target: "leaf-mgmt-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d1", target: "leaf-mgmt-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d1", target: "leaf-mgmt-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d1", target: "leaf-mgmt-d4", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d2", target: "leaf-mgmt-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d2", target: "leaf-mgmt-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d2", target: "leaf-mgmt-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d2", target: "leaf-mgmt-d4", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d3", target: "leaf-mgmt-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d3", target: "leaf-mgmt-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d3", target: "leaf-mgmt-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-d3", target: "leaf-mgmt-d4", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Spine <-> Border Leaf (data plane, full mesh — same pattern as Option C)
  { source: "spine-data-d1", target: "border-leaf-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d1", target: "border-leaf-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d2", target: "border-leaf-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d2", target: "border-leaf-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d3", target: "border-leaf-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-d3", target: "border-leaf-d2", plane: "data", type: "routing_adjacency", weight: 1 },

  // Leaf -> Rack (dual-leaf racks 1-3, single-leaf racks 4-6 — same shape as Option C)
  { source: "leaf-data-d1", target: "rack-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d2", target: "rack-d1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d1", target: "rack-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d2", target: "rack-d2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d3", target: "rack-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d4", target: "rack-d3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d3", target: "rack-d4", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d4", target: "rack-d5", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-d2", target: "rack-d6", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d1", target: "rack-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d2", target: "rack-d1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d1", target: "rack-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d2", target: "rack-d2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d3", target: "rack-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d4", target: "rack-d3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d3", target: "rack-d4", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d4", target: "rack-d5", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-d2", target: "rack-d6", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // Rack -> Server containment
  { source: "rack-d1", target: "server-d1-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d1", target: "server-d1-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d1", target: "server-d1-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d1", target: "server-d1-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d1", target: "server-d1-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d1", target: "server-d1-06", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d2", target: "server-d2-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d2", target: "server-d2-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d2", target: "server-d2-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d2", target: "server-d2-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d2", target: "server-d2-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-06", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-07-gpu", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d3", target: "server-d3-08-gpu", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d4", target: "server-d4-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d4", target: "server-d4-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d4", target: "server-d4-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d4", target: "server-d4-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-06", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d5", target: "server-d5-07", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d6", target: "server-d6-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d6", target: "server-d6-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d6", target: "server-d6-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d6", target: "server-d6-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-d6", target: "server-d6-05", plane: "shared", type: "containment", weight: 1 }
];

export const fixtureMeta = {
  option: "D",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  dualLeafRacks: ["rack-d1", "rack-d2", "rack-d3"],
  singleLeafRacks: ["rack-d4", "rack-d5", "rack-d6"],
  borderLeaves: ["border-leaf-d1", "border-leaf-d2"],
  superspines: ["superspine-data-1", "superspine-data-2", "superspine-mgmt-1", "superspine-mgmt-2"],
  sharedRackControllerGroups: [
    { controllers: ["rc-d1a", "rc-d1b"], racks: ["rack-d1", "rack-d2"] },
    { controllers: ["rc-d3a", "rc-d3b"], racks: ["rack-d3", "rack-d4"] }
  ],
  azOverrideServer: "server-d1-06"
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

