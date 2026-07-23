/**
 * Fixture data — Option A (very small deployment)
 *
 * Companion to: radial-layered-topology-viz-spec.md §3.3 Option A row.
 *
 * Structure:
 *   - 1 TOR / managed switch (ring R4 — relabelled "TOR" via `meta.ringNames`)
 *   - 1 Rack (ring R5) grouping all servers under the single TOR
 *   - 5 servers (ring R6), including 1 GPU/accelerator node
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

  // ---- R5 Rack ----
  {
    id: "rack-a1",
    ring: "R5",
    label: "Rack 1",
    weight: 5,
    plane: "shared",
    leaf_role: "n/a",
    trust_tier: "operator",
    failure_domain_role: "spof",
    rack_controller_ids: ["rc-a1"],
    availability_zone: "az-1",
    metadata: { leaf_count: 1, data_leaves: ["tor-1"], note: "Single-TOR: TOR failure == rack failure." }
  },

  { id: "server-a-01", ring: "R6", label: "Srv01", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-a1", note: "10/25 GbE server access port." } },
  { id: "server-a-02", ring: "R6", label: "Srv02", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-a1", note: "10/25 GbE server access port." } },
  { id: "server-a-03", ring: "R6", label: "Srv03", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-a1", note: "10/25 GbE server access port." } },
  { id: "server-a-04", ring: "R6", label: "Srv04", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-a1", note: "10/25 GbE server access port." } },
  { id: "server-a-05-gpu", ring: "R6", label: "GPU05", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-a1", node_type: "gpu", accelerators: 2, description: "Optional AI inference node with one or more GPUs." } }
];

export const links = [
  // TOR -> Rack
  { source: "tor-1", target: "rack-a1", plane: "shared", type: "routing_adjacency", weight: 1 },

  // Rack -> Server (containment)
  { source: "rack-a1", target: "server-a-01",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-a1", target: "server-a-02",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-a1", target: "server-a-03",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-a1", target: "server-a-04",     plane: "shared", type: "containment", weight: 1 },
  { source: "rack-a1", target: "server-a-05-gpu", plane: "shared", type: "containment", weight: 1 }
];

export const fixtureMeta = {
  option: "A",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  torCount: 1,
  racks: ["rack-a1"]
};

export const meta = {
  option: "A",
  label: "Option A",
  title: "Option A · Very Small Deployment",
  subtitle: "3–8 Servers · Single Managed Switch",
  ringNames: { R4: "TOR", R5: "Rack", R6: "Server" }
};

