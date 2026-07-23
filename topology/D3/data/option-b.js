/**
 * Fixture data — Option B (small resilient deployment)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option B row,
 * §6.1a (same-ring peer-adjacency link).
 *
 * Structure (per the demo's simplified illustrative model):
 *   - 2 ToR switches (ring R4, relabelled "TOR" via `meta.ringNames`), each
 *     directly parenting the full server collection (dual-homed servers,
 *     matching the reference architecture's "servers MUST establish eBGP
 *     sessions with ToR switches" / ECMP resiliency model) — no Rack (R5)
 *     or Pod (R1) ring populated, mirroring Option A's simplified 2-tier
 *     shape (§3.3 note: ToR occupies the R3/R4 slot directly since B has no
 *     distinct leaf/spine split).
 *   - The two ToRs carry an explicit same-ring `peer_adjacency` link (§6.1a)
 *     representing their direct uplink/adjacency — rendered via the virtual
 *     -gap radial/circular path grammar, distinct gold colour (§6.2).
 *   - 8 servers (ring R6), each dual-homed to BOTH ToRs — tolerates a single
 *     ToR failure and a single uplink failure per the option's Resiliency
 *     model, so long as routing converges correctly.
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

  { id: "server-b-01", ring: "R6", label: "Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-02", ring: "R6", label: "Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-03", ring: "R6", label: "Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-04", ring: "R6", label: "Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-05", ring: "R6", label: "Srv05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-06", ring: "R6", label: "Srv06", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-07", ring: "R6", label: "Srv07", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: {} },
  { id: "server-b-08-gpu", ring: "R6", label: "GPU08", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { node_type: "gpu", accelerators: 2, description: "Small AI inference cluster node." } }
];

export const links = [
  // Same-ring peer-adjacency link (§6.1a) — the ToR-to-ToR direct uplink.
  { source: "tor-1", target: "tor-2", plane: "shared", type: "peer_adjacency", weight: 1 },

  // Dual-homed servers — every server links to BOTH ToRs. Primary-group
  // anchor (first-listed link per server, used only for radial clustering —
  // see layout.js's baseRing grouping) alternates between tor-1/tor-2 so the
  // server ring visually splits into two clusters, one per ToR, rather than
  // clustering entirely under whichever ToR happens to be listed first.
  { source: "tor-1", target: "server-b-01", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-01", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-02", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-02", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-03", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-03", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-04", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-04", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-05", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-05", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-06", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-06", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-07", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-07", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-2", target: "server-b-08-gpu", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-b-08-gpu", plane: "shared", type: "routing_adjacency", weight: 1 }
];

export const fixtureMeta = {
  option: "B",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  torPeerLink: ["tor-1", "tor-2"]
};

export const meta = {
  option: "B",
  label: "Option B",
  title: "Option B · Small Resilient Deployment",
  subtitle: "6–32 Servers · Dual ToR · Dual-Homed Servers",
  ringNames: { R4: "TOR", R6: "Server" }
};


