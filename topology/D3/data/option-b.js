/**
 * Fixture data — Option B (small resilient deployment)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option B row,
 * §6.1a (same-ring peer-adjacency link).
 *
 * Structure:
 *   - 2 ToR switches (ring R4, relabelled "TOR" via `meta.ringNames`)
 *   - 2 Racks (ring R5) — rack-b1 clusters servers 01/03/05/07 (primary TOR-1),
 *     rack-b2 clusters servers 02/04/06/08-gpu (primary TOR-2). Both TORs
 *     connect to both racks, expressing dual-homing at the rack level.
 *   - The two ToRs carry an explicit same-ring `peer_adjacency` link (§6.1a).
 *   - 8 servers (ring R6), each dual-homed to BOTH ToRs via their rack.
 */

export const nodes = [
  {
    id: "tor-1",
    ring: "R4",
    label: "TOR-1",
    weight: 8,
    plane: "shared",
    leaf_role: "access",
    trust_tier: "operator",
    failure_domain_role: "redundant",
    rack_controller_ids: ["rc-b1"],
    availability_zone: "n/a",
    metadata: { role: "tor", description: "Top-of-rack switch running Ubuntu NOS; dual-homed servers tolerate a single ToR failure." }
  },
  {
    id: "tor-2",
    ring: "R4",
    label: "TOR-2",
    weight: 8,
    plane: "shared",
    leaf_role: "access",
    trust_tier: "operator",
    failure_domain_role: "redundant",
    rack_controller_ids: ["rc-b1"],
    availability_zone: "n/a",
    metadata: { role: "tor", description: "Top-of-rack switch running Ubuntu NOS; dual-homed servers tolerate a single ToR failure." }
  },

  // ---- R5 Rack ----
  { id: "rack-b1", ring: "R5", label: "Rack 1", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-b1"], availability_zone: "az-1", metadata: { leaf_count: 2, data_leaves: ["tor-1", "tor-2"], note: "Dual-TOR: tolerates a single ToR failure." } },
  { id: "rack-b2", ring: "R5", label: "Rack 2", weight: 4, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "redundant", rack_controller_ids: ["rc-b1"], availability_zone: "az-2", metadata: { leaf_count: 2, data_leaves: ["tor-1", "tor-2"], note: "Dual-TOR: tolerates a single ToR failure." } },

  { id: "server-b-01", ring: "R6", label: "Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b1" } },
  { id: "server-b-02", ring: "R6", label: "Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b2" } },
  { id: "server-b-03", ring: "R6", label: "Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b1" } },
  { id: "server-b-04", ring: "R6", label: "Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b2" } },
  { id: "server-b-05", ring: "R6", label: "Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b1" } },
  { id: "server-b-06", ring: "R6", label: "Srv06", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b2" } },
  { id: "server-b-07", ring: "R6", label: "Srv07", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b1" } },
  { id: "server-b-08-gpu", ring: "R6", label: "GPU08", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-b2", node_type: "gpu", accelerators: 2, description: "Small AI inference cluster node." } }
];

export const links = [
  // Same-ring peer-adjacency link (§6.1a) — the ToR-to-ToR direct uplink.
  { source: "tor-1", target: "tor-2", plane: "shared", type: "peer_adjacency", weight: 1 },

  // Both TORs connect to both racks — dual-homing expressed at rack level.
  // Primary anchor for rack clustering: tor-1 listed first for rack-b1,
  // tor-2 listed first for rack-b2, so the two racks fan out on opposite sides.
  { source: "tor-1", target: "rack-b1", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "rack-b1", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "rack-b2", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "rack-b2", plane: "shared", type: "routing_adjacency", weight: 1 },

  // Rack -> Server (containment)
  { source: "rack-b1", target: "server-b-01",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b1", target: "server-b-03",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b1", target: "server-b-05",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b1", target: "server-b-07",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b2", target: "server-b-02",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b2", target: "server-b-04",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b2", target: "server-b-06",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-b2", target: "server-b-08-gpu", plane: "shared", type: "containment", weight: 1 }
];

export const fixtureMeta = {
  option: "B",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  torPeerLink: ["tor-1", "tor-2"],
  racks: ["rack-b1", "rack-b2"],
  dualLeafRacks: ["rack-b1", "rack-b2"]
};

export const meta = {
  option: "B",
  label: "Option B",
  title: "Option B · Small Resilient Deployment",
  subtitle: "6–32 Servers · Dual ToR · Dual-Homed Servers",
  ringNames: { R4: "TOR", R5: "Rack", R6: "Server" }
};

