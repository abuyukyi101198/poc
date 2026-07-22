/**
 * Phase 0 fixture data — Option C (standard leaf-spine datacenter pod)
 *
 * Companion to: radial-layered-topology-viz-spec.md (schema: §9.1)
 *               demo-implementation-action-plan.md (Phase 0)
 *
 * Contents, by design (per action plan §4 Phase 0):
 *   - 1 pod
 *   - 2 data spines, 2 management spines
 *   - 4 data leaves, 4 management leaves
 *   - 6 racks: rack-1, rack-2, rack-3 are DUAL-LEAF (redundant, two leaf
 *     parents per plane); rack-4, rack-5, rack-6 are SINGLE-LEAF (leaf
 *     failure == rack failure, per spec §7.3)
 *   - 35 servers total, 4-8 per rack, including 2 GPU/accelerator nodes
 *   - 1 border leaf, stub node only (spec §7.5 — satellite, not a ring)
 *
 * Ring order (inner -> outer), per spec §3.1 as flipped:
 *   R0 Region (not populated at Option C) -> R1 Pod -> R2 Tier-1 (not
 *   populated at Option C) -> R3 Tier-2/Spine -> R4 Tier-3/Leaf ->
 *   R5 Rack -> R6 Server (outermost)
 *
 * Weight = deduplicated downstream server count (spec §5.2, default
 * weight_mode), computed by hand here so the fixture is self-consistent:
 *   rack-1=6, rack-2=5, rack-3=8, rack-4=4, rack-5=7, rack-6=5  (=35 total)
 *   leaf-data-1  -> racks 1,2      -> 6+5=11
 *   leaf-data-2  -> racks 1,2,6    -> 6+5+5=16
 *   leaf-data-3  -> racks 3,4      -> 8+4=12
 *   leaf-data-4  -> racks 3,5      -> 8+7=15
 *   leaf-mgmt-*  -> mirrors leaf-data-* rack assignment (same racks)
 *   spine-data-1/2, spine-mgmt-1/2, pod-1 -> all racks -> 35
 *
 * Notes for the implementing agent:
 *   - rack -> server links are the ONLY links touching the server ring.
 *     Per spec §6.1, a server never links directly to a leaf/spine; the
 *     leaf<->rack link stands in for the aggregate NIC attachment.
 *   - border-leaf-1 intentionally has no `ring` value from the standard
 *     set — it renders as the satellite glyph described in spec §7.5,
 *     breaking inward past the pod ring, not as a ring member.
 *   - Categorization-layer fields (trust_tier, failure_domain_role) are
 *     populated even though rendering them is out of scope for this demo
 *     (action plan §1), so the schema doesn't need to migrate later.
 */

export const nodes = [
  // ---- R1 Pod ----
  {
    id: "pod-1",
    ring: "R1",
    label: "Pod 1",
    weight: 35,
    plane: "shared",
    trust_tier: "n/a",
    failure_domain_role: "n/a",
    metadata: { role: "pod", description: "Single standard leaf-spine pod (Option C)." }
  },

  // ---- R3 Tier-2 / Spine ----
  { id: "spine-data-1", ring: "R3", label: "Data Spine 1", weight: 35, plane: "data", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "spine" } },
  { id: "spine-data-2", ring: "R3", label: "Data Spine 2", weight: 35, plane: "data", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "spine" } },
  { id: "spine-mgmt-1", ring: "R3", label: "Mgmt Spine 1", weight: 35, plane: "mgmt", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "spine" } },
  { id: "spine-mgmt-2", ring: "R3", label: "Mgmt Spine 2", weight: 35, plane: "mgmt", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "spine" } },

  // ---- R4 Tier-3 / Leaf ----
  { id: "leaf-data-1", ring: "R4", label: "Data Leaf 1", weight: 11, plane: "data", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-1", "rack-2"] } },
  { id: "leaf-data-2", ring: "R4", label: "Data Leaf 2", weight: 16, plane: "data", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-1", "rack-2", "rack-6"] } },
  { id: "leaf-data-3", ring: "R4", label: "Data Leaf 3", weight: 12, plane: "data", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-3", "rack-4"] } },
  { id: "leaf-data-4", ring: "R4", label: "Data Leaf 4", weight: 15, plane: "data", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-3", "rack-5"] } },

  { id: "leaf-mgmt-1", ring: "R4", label: "Mgmt Leaf 1", weight: 11, plane: "mgmt", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-1", "rack-2"] } },
  { id: "leaf-mgmt-2", ring: "R4", label: "Mgmt Leaf 2", weight: 16, plane: "mgmt", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-1", "rack-2", "rack-6"] } },
  { id: "leaf-mgmt-3", ring: "R4", label: "Mgmt Leaf 3", weight: 12, plane: "mgmt", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-3", "rack-4"] } },
  { id: "leaf-mgmt-4", ring: "R4", label: "Mgmt Leaf 4", weight: 15, plane: "mgmt", trust_tier: "operator", failure_domain_role: "n/a", metadata: { role: "leaf", serves_racks: ["rack-3", "rack-5"] } },

  // ---- Border leaf (satellite, spec §7.5 — not a ring member) ----
  {
    id: "border-leaf-1",
    ring: "SAT",
    label: "Border Leaf 1",
    weight: 1,
    plane: "data",
    trust_tier: "operator",
    failure_domain_role: "n/a",
    metadata: { role: "border_leaf", description: "Stub only for this demo — external/WAN/DCI connectivity, breaks inward past the pod ring per spec §7.5." }
  },

  // ---- R5 Rack ----
  { id: "rack-1", ring: "R5", label: "Rack 1", weight: 6, plane: "shared", trust_tier: "operator", failure_domain_role: "redundant", metadata: { leaf_count: 2, data_leaves: ["leaf-data-1", "leaf-data-2"], mgmt_leaves: ["leaf-mgmt-1", "leaf-mgmt-2"] } },
  { id: "rack-2", ring: "R5", label: "Rack 2", weight: 5, plane: "shared", trust_tier: "operator", failure_domain_role: "redundant", metadata: { leaf_count: 2, data_leaves: ["leaf-data-1", "leaf-data-2"], mgmt_leaves: ["leaf-mgmt-1", "leaf-mgmt-2"] } },
  { id: "rack-3", ring: "R5", label: "Rack 3", weight: 8, plane: "shared", trust_tier: "operator", failure_domain_role: "redundant", metadata: { leaf_count: 2, data_leaves: ["leaf-data-3", "leaf-data-4"], mgmt_leaves: ["leaf-mgmt-3", "leaf-mgmt-4"], note: "Contains GPU/accelerator nodes." } },
  { id: "rack-4", ring: "R5", label: "Rack 4", weight: 4, plane: "shared", trust_tier: "operator", failure_domain_role: "spof", metadata: { leaf_count: 1, data_leaves: ["leaf-data-3"], mgmt_leaves: ["leaf-mgmt-3"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-5", ring: "R5", label: "Rack 5", weight: 7, plane: "shared", trust_tier: "operator", failure_domain_role: "spof", metadata: { leaf_count: 1, data_leaves: ["leaf-data-4"], mgmt_leaves: ["leaf-mgmt-4"], note: "Single-leaf: leaf failure == rack failure." } },
  { id: "rack-6", ring: "R5", label: "Rack 6", weight: 5, plane: "shared", trust_tier: "tenant", failure_domain_role: "spof", metadata: { leaf_count: 1, data_leaves: ["leaf-data-2"], mgmt_leaves: ["leaf-mgmt-2"], note: "Single-leaf, tenant-controlled bare-metal servers." } },

  // ---- R6 Server (outermost) ----
  // Rack 1 -- 6 servers
  { id: "server-1-01", ring: "R6", label: "R1-Srv01", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-1" } },
  { id: "server-1-02", ring: "R6", label: "R1-Srv02", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-1" } },
  { id: "server-1-03", ring: "R6", label: "R1-Srv03", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-1" } },
  { id: "server-1-04", ring: "R6", label: "R1-Srv04", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-1" } },
  { id: "server-1-05", ring: "R6", label: "R1-Srv05", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-1" } },
  { id: "server-1-06", ring: "R6", label: "R1-Srv06", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-1" } },

  // Rack 2 -- 5 servers
  { id: "server-2-01", ring: "R6", label: "R2-Srv01", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-2" } },
  { id: "server-2-02", ring: "R6", label: "R2-Srv02", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-2" } },
  { id: "server-2-03", ring: "R6", label: "R2-Srv03", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-2" } },
  { id: "server-2-04", ring: "R6", label: "R2-Srv04", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-2" } },
  { id: "server-2-05", ring: "R6", label: "R2-Srv05", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-2" } },

  // Rack 3 -- 8 servers, including 2 GPU/accelerator nodes
  { id: "server-3-01", ring: "R6", label: "R3-Srv01", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3" } },
  { id: "server-3-02", ring: "R6", label: "R3-Srv02", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3" } },
  { id: "server-3-03", ring: "R6", label: "R3-Srv03", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3" } },
  { id: "server-3-04", ring: "R6", label: "R3-Srv04", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3" } },
  { id: "server-3-05", ring: "R6", label: "R3-Srv05", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3" } },
  { id: "server-3-06", ring: "R6", label: "R3-Srv06", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3" } },
  { id: "server-3-07-gpu", ring: "R6", label: "R3-GPU07", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3", node_type: "gpu", accelerators: 4 } },
  { id: "server-3-08-gpu", ring: "R6", label: "R3-GPU08", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-3", node_type: "gpu", accelerators: 4 } },

  // Rack 4 -- 4 servers
  { id: "server-4-01", ring: "R6", label: "R4-Srv01", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-4" } },
  { id: "server-4-02", ring: "R6", label: "R4-Srv02", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-4" } },
  { id: "server-4-03", ring: "R6", label: "R4-Srv03", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-4" } },
  { id: "server-4-04", ring: "R6", label: "R4-Srv04", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-4" } },

  // Rack 5 -- 7 servers
  { id: "server-5-01", ring: "R6", label: "R5-Srv01", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },
  { id: "server-5-02", ring: "R6", label: "R5-Srv02", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },
  { id: "server-5-03", ring: "R6", label: "R5-Srv03", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },
  { id: "server-5-04", ring: "R6", label: "R5-Srv04", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },
  { id: "server-5-05", ring: "R6", label: "R5-Srv05", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },
  { id: "server-5-06", ring: "R6", label: "R5-Srv06", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },
  { id: "server-5-07", ring: "R6", label: "R5-Srv07", weight: 1, plane: "shared", trust_tier: "operator", failure_domain_role: "n/a", metadata: { rack: "rack-5" } },

  // Rack 6 -- 5 servers, tenant-controlled bare-metal
  { id: "server-6-01", ring: "R6", label: "R6-Srv01", weight: 1, plane: "shared", trust_tier: "tenant", failure_domain_role: "n/a", metadata: { rack: "rack-6" } },
  { id: "server-6-02", ring: "R6", label: "R6-Srv02", weight: 1, plane: "shared", trust_tier: "tenant", failure_domain_role: "n/a", metadata: { rack: "rack-6" } },
  { id: "server-6-03", ring: "R6", label: "R6-Srv03", weight: 1, plane: "shared", trust_tier: "tenant", failure_domain_role: "n/a", metadata: { rack: "rack-6" } },
  { id: "server-6-04", ring: "R6", label: "R6-Srv04", weight: 1, plane: "shared", trust_tier: "tenant", failure_domain_role: "n/a", metadata: { rack: "rack-6" } },
  { id: "server-6-05", ring: "R6", label: "R6-Srv05", weight: 1, plane: "shared", trust_tier: "tenant", failure_domain_role: "n/a", metadata: { rack: "rack-6" } }
];

export const links = [
  // ---- Physical containment (grey skeleton): pod -> rack ----
  { source: "pod-1", target: "rack-1", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-1", target: "rack-2", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-1", target: "rack-3", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-1", target: "rack-4", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-1", target: "rack-5", plane: "shared", type: "containment", weight: 1 },
  { source: "pod-1", target: "rack-6", plane: "shared", type: "containment", weight: 1 },

  // ---- Physical containment (grey skeleton): rack -> server ----
  // Rack 1
  { source: "rack-1", target: "server-1-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-1", target: "server-1-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-1", target: "server-1-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-1", target: "server-1-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-1", target: "server-1-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-1", target: "server-1-06", plane: "shared", type: "containment", weight: 1 },
  // Rack 2
  { source: "rack-2", target: "server-2-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-2", target: "server-2-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-2", target: "server-2-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-2", target: "server-2-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-2", target: "server-2-05", plane: "shared", type: "containment", weight: 1 },
  // Rack 3
  { source: "rack-3", target: "server-3-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-06", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-07-gpu", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-3", target: "server-3-08-gpu", plane: "shared", type: "containment", weight: 1 },
  // Rack 4
  { source: "rack-4", target: "server-4-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-4", target: "server-4-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-4", target: "server-4-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-4", target: "server-4-04", plane: "shared", type: "containment", weight: 1 },
  // Rack 5
  { source: "rack-5", target: "server-5-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-5", target: "server-5-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-5", target: "server-5-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-5", target: "server-5-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-5", target: "server-5-05", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-5", target: "server-5-06", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-5", target: "server-5-07", plane: "shared", type: "containment", weight: 1 },
  // Rack 6
  { source: "rack-6", target: "server-6-01", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-6", target: "server-6-02", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-6", target: "server-6-03", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-6", target: "server-6-04", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-6", target: "server-6-05", plane: "shared", type: "containment", weight: 1 },

  // ---- Data-plane routing adjacency: pod -> data spine (fabric root within pod) ----
  { source: "pod-1", target: "spine-data-1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "pod-1", target: "spine-data-2", plane: "data", type: "routing_adjacency", weight: 1 },

  // ---- Data-plane routing adjacency: spine <-> leaf (full mesh / ECMP) ----
  { source: "spine-data-1", target: "leaf-data-1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-1", target: "leaf-data-2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-1", target: "leaf-data-3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-1", target: "leaf-data-4", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-2", target: "leaf-data-1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-2", target: "leaf-data-2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-2", target: "leaf-data-3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "spine-data-2", target: "leaf-data-4", plane: "data", type: "routing_adjacency", weight: 1 },

  // ---- Data-plane routing adjacency: leaf -> rack ----
  // Dual-leaf racks (1, 2, 3) receive two data-leaf parents each.
  { source: "leaf-data-1", target: "rack-1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-2", target: "rack-1", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-1", target: "rack-2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-2", target: "rack-2", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-3", target: "rack-3", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-4", target: "rack-3", plane: "data", type: "routing_adjacency", weight: 1 },
  // Single-leaf racks (4, 5, 6) receive one data-leaf parent.
  { source: "leaf-data-3", target: "rack-4", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-4", target: "rack-5", plane: "data", type: "routing_adjacency", weight: 1 },
  { source: "leaf-data-2", target: "rack-6", plane: "data", type: "routing_adjacency", weight: 1 },

  // ---- Management-plane routing adjacency: pod -> mgmt spine ----
  { source: "pod-1", target: "spine-mgmt-1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "pod-1", target: "spine-mgmt-2", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // ---- Management-plane routing adjacency: spine <-> leaf (full mesh / ECMP) ----
  { source: "spine-mgmt-1", target: "leaf-mgmt-1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-1", target: "leaf-mgmt-2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-1", target: "leaf-mgmt-3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-1", target: "leaf-mgmt-4", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-2", target: "leaf-mgmt-1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-2", target: "leaf-mgmt-2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-2", target: "leaf-mgmt-3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "spine-mgmt-2", target: "leaf-mgmt-4", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // ---- Management-plane routing adjacency: leaf -> rack ----
  // Mirrors the data-plane rack assignment (same racks, mgmt-leaf equivalents).
  { source: "leaf-mgmt-1", target: "rack-1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-2", target: "rack-1", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-1", target: "rack-2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-2", target: "rack-2", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-3", target: "rack-3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-4", target: "rack-3", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-3", target: "rack-4", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-4", target: "rack-5", plane: "mgmt", type: "routing_adjacency", weight: 1 },
  { source: "leaf-mgmt-2", target: "rack-6", plane: "mgmt", type: "routing_adjacency", weight: 1 },

  // ---- Border connectivity (stub, spec §7.5) ----
  { source: "pod-1", target: "border-leaf-1", plane: "data", type: "border_connectivity", weight: 1 }
];

/**
 * Convenience export: quick integrity checks the renderer (or a unit test)
 * can run at load time to catch fixture drift.
 *   - Every link's source/target must resolve to a node id.
 *   - Every R6 server must have exactly one containment parent (its rack).
 *   - Dual-leaf racks (per metadata.leaf_count === 2) must have exactly
 *     two routing_adjacency parents per plane; single-leaf racks exactly one.
 *
 * Phase 6 schema sanity-check (action plan §4 Phase 6 / spec §9.1):
 *   Node fields present: id, ring, label, weight, plane, trust_tier,
 *     failure_domain_role, metadata.  No ad-hoc fields added.
 *   Link fields present: source, target, plane, type, weight.  No ad-hoc fields.
 *   `_centroid` appears only on layoutNodes (computed by layout.js), not here.
 */
export const fixtureMeta = {
  option: "C",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  dualLeafRacks: ["rack-1", "rack-2", "rack-3"],
  singleLeafRacks: ["rack-4", "rack-5", "rack-6"]
};
