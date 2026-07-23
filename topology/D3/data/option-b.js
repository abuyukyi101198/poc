/**
 * Fixture data — Option B (small resilient deployment)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option B row,
 * §6.1a (same-ring peer-adjacency link).
 *
 * Structure:
 *   - 2 ToR switches (ring R4, relabelled "TOR" via `meta.ringNames`)
 *   - 2 Racks (ring R5) — rack-001 clusters servers 001/003/005/007 (primary TOR-1),
 *     rack-002 clusters servers 002/004/006/008 (primary TOR-2). Both TORs
 *     connect to both racks, expressing dual-homing at the rack level.
 *   - The two ToRs carry an explicit same-ring `peer_adjacency` link (§6.1a).
 *   - 8 servers (ring R6), each dual-homed to BOTH ToRs via their rack.
 */

export const nodes = [
  {
    id: "tor-001",
    ring: "R4",
    label: "TOR-001",
    weight: 8,
    plane: "shared",
    leaf_role: "access",
    trust_tier: "operator",
    failure_domain_role: "redundant",
    rack_controller_ids: [],
    availability_zone: "n/a",
    metadata: { role: "tor", description: "Top-of-rack switch running Ubuntu NOS; dual-homed servers tolerate a single ToR failure." }
  },
  {
    id: "tor-002",
    ring: "R4",
    label: "TOR-002",
    weight: 8,
    plane: "shared",
    leaf_role: "access",
    trust_tier: "operator",
    failure_domain_role: "redundant",
    rack_controller_ids: [],
    availability_zone: "n/a",
    metadata: { role: "tor", description: "Top-of-rack switch running Ubuntu NOS; dual-homed servers tolerate a single ToR failure." }
  },

  // ---- R5 Rack ----
  { id: "rack-001", ring: "R5", label: "Rack-001", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-001"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["tor-001", "tor-002"], note: "Dual-TOR: tolerates a single ToR failure." } },
  { id: "rack-002", ring: "R5", label: "Rack-002", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-001"], availability_zone: "az-2", metadata: { leaf_count: 2, data_leaves: ["tor-001", "tor-002"], note: "Dual-TOR: tolerates a single ToR failure." } },

  { id: "server-001", ring: "R6", label: "Srv-001", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001" } },
  { id: "server-002", ring: "R6", label: "Srv-002", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
  { id: "server-003", ring: "R6", label: "Srv-003", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001" } },
  { id: "server-004", ring: "R6", label: "Srv-004", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
  { id: "server-005", ring: "R6", label: "Srv-005", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant",   failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001" } },
  { id: "server-006", ring: "R6", label: "Srv-006", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant",   failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002" } },
  { id: "server-007", ring: "R6", label: "Srv-007", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001" } },
  { id: "server-008", ring: "R6", label: "Srv-008", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-002", node_type: "gpu", accelerators: 2, description: "Small AI inference cluster node." } }
];

export const links = [
  // Same-ring peer-adjacency link (§6.1a) — the ToR-to-ToR direct uplink.
  { source: "tor-001", target: "tor-002", plane: "shared", type: "peer_adjacency", weight: 1 },

  // Both TORs connect to both racks — dual-homing expressed at rack level.
  // Primary anchor for rack clustering: tor-001 listed first for rack-001,
  // tor-002 listed first for rack-002, so the two racks fan out on opposite sides.
  { source: "tor-001", target: "rack-001", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-002", target: "rack-001", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-002", target: "rack-002", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-001", target: "rack-002", plane: "shared", type: "routing_adjacency", weight: 1 },

  // Rack -> Server (containment)
  { source: "rack-001", target: "server-001", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-003", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-005", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-007", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-002", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-004", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-006", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-002", target: "server-008", plane: "shared", type: "containment", weight: 1 }
];

export const fixtureMeta = {
  option: "B",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  torPeerLink: ["tor-001", "tor-002"],
  racks: ["rack-001", "rack-002"],
  dualLeafRacks: ["rack-001", "rack-002"]
};

export const meta = {
  option: "B",
  label: "Option B",
  title: "Option B · Small Resilient Deployment",
  subtitle: "6–32 Servers · Dual ToR · Dual-Homed Servers",
  ringNames: { R4: "TOR", R5: "Rack", R6: "Server" }
};
