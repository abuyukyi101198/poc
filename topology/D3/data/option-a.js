/**
 * Fixture data — Option A (very small deployment)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option A row.
 *
 * Structure (per the demo's simplified illustrative model — a single
 * managed switch acting as the direct parent of every server, matching the
 * reference architecture's "single managed switch is acceptable" physical
 * network guidance):
 *   - 1 TOR / managed switch (ring R4 — reuses the Leaf tier position, but
 *     is relabelled "TOR" for this option via `meta.ringNames`, since there
 *     is no leaf/spine split at this scale)
 *   - 5 servers (ring R6), including 1 GPU/accelerator node, linked directly
 *     to the TOR — no Rack (R5) or Pod (R1) ring is populated, since at this
 *     scale a rack/pod distinction adds no useful information (§3.3: "single
 *     managed switch is drawn as an R5 rack-attribute... there is no tier
 *     structure to speak of" — simplified here to a direct TOR->Server
 *     parent/child link for a clearer illustration).
 *
 * No dual-homing, no peer link, no separate management plane split — this
 * option has no switch-level redundancy per its Resiliency model.
 */

export const nodes = [
  {
    id: "tor-1",
    ring: "R4",
    label: "TOR-1",
    weight: 5,
    plane: "shared",
    leaf_role: "access",
    trust_tier: "operator",
    failure_domain_role: "spof",
    rack_controller_ids: ["rc-a1"],
    availability_zone: "n/a",
    metadata: {
      role: "tor",
      description: "Single managed Layer 2/Layer 3 switch running Ubuntu NOS and MAAS — no switch-level redundancy at this scale."
    }
  },

  { id: "server-a-01", ring: "R6", label: "Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { note: "10/25 GbE server access port." } },
  { id: "server-a-02", ring: "R6", label: "Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { note: "10/25 GbE server access port." } },
  { id: "server-a-03", ring: "R6", label: "Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { note: "10/25 GbE server access port." } },
  { id: "server-a-04", ring: "R6", label: "Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { note: "10/25 GbE server access port." } },
  { id: "server-a-05-gpu", ring: "R6", label: "GPU05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { node_type: "gpu", accelerators: 2, description: "Optional AI inference node with one or more GPUs." } }
];

export const links = [
  { source: "tor-1", target: "server-a-01", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-a-02", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-a-03", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-a-04", plane: "shared", type: "routing_adjacency", weight: 1 },
  { source: "tor-1", target: "server-a-05-gpu", plane: "shared", type: "routing_adjacency", weight: 1 }
];

export const fixtureMeta = {
  option: "A",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  torCount: 1
};

export const meta = {
  option: "A",
  label: "Option A",
  title: "Option A · Very Small Deployment",
  subtitle: "3–8 Servers · Single Managed Switch",
  // R4 is relabelled "TOR" for this option (no leaf/spine split at this
  // scale); R6 stays "Server" (matches the global default, listed here for
  // clarity).
  ringNames: { R4: "TOR", R6: "Server" }
};

