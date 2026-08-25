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
    id: "tor-001",
    ring: "R4",
    label: "TOR-001",
    weight: 5,
    plane: "shared",
    leaf_role: "access",
    trust_tier: "operator",
    failure_domain_role: "spof",
    rack_controller_ids: [],
    availability_zone: "n/a",
    metadata: {
      role: "tor",
      description: "Single managed Layer 2/Layer 3 switch running Ubuntu NOS and MAAS — no switch-level redundancy at this scale."
    }
  },

  // ---- R5 Rack ----
  {
    id: "rack-001",
    ring: "R5",
    label: "Rack-001",
    weight: 5,
    plane: "shared",
    leaf_role: "n/a",
    trust_tier: "operator",
    failure_domain_role: "spof",
    rack_controller_ids: ["rc-001"],
    availability_zone: "az-1",
    metadata: { leaf_count: 1, data_leaves: ["tor-001"], note: "Single-TOR: TOR failure == rack failure." }
  },

  { id: "server-001", ring: "R6", label: "Srv-001", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001", note: "10/25 GbE server access port." } },
  { id: "server-002", ring: "R6", label: "Srv-002", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001", note: "10/25 GbE server access port." } },
  { id: "server-003", ring: "R6", label: "Srv-003", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001", note: "10/25 GbE server access port." } },
  { id: "server-004", ring: "R6", label: "Srv-004", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "tenant",   failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001", note: "10/25 GbE server access port." } },
  { id: "server-005", ring: "R6", label: "Srv-005", weight: 1, plane: "shared", leaf_role: "n/a", trust_tier: "operator", failure_domain_role: "n/a", rack_controller_ids: [], availability_zone: "n/a", metadata: { rack: "rack-001", node_type: "gpu", accelerators: 2, description: "Optional AI inference node with one or more GPUs." } }
];

export const links = [
  // TOR -> Rack
  { source: "tor-001", target: "rack-001", plane: "shared", type: "routing_adjacency", weight: 1 },

  // Rack -> Server (containment)
  { source: "rack-001", target: "server-001", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-002", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-003", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-004", plane: "shared", type: "containment", weight: 1 },
  { source: "rack-001", target: "server-005", plane: "shared", type: "containment", weight: 1 }
];

export const fixtureMeta = {
  option: "A",
  totalServers: nodes.filter(n => n.ring === "R6").length,
  torCount: 1,
  racks: ["rack-001"]
};

export const meta = {
  option: "A",
  label: "Option A",
  title: "Option A · Very Small Deployment",
  subtitle: "3–8 Servers · Single Managed Switch",
  ringNames: { R4: "TOR", R5: "Rack", R6: "Server" }
};
