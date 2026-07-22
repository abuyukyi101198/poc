# Specification: Radial Layered (Sugiyama) Graph — Circular Dendrogram Topology Visualization

### Datacenter Network Topology Visualization

**Status:** Final
**Scope:** Visual design and data model. Does not specify a rendering framework or implementation stack.
**Reference basis:** Reference deployment options A–D (small deployment → large multi-pod datacenter), as established in
prior design discussion.

---

## 1. Purpose

This visualization represents datacenter topologies containing multiple overlapping routing and containment hierarchies
while preserving explicit parent-child connectivity. Nodes occupy fixed concentric rings representing hierarchy depth,
while relationships are expressed through explicit inter-ring links rather than inferred from geometric nesting. The
model supports multiple parents per node, redundant routing paths, and multiple coexisting network planes without
duplicating physical infrastructure.

The visualization is implementation-agnostic and specifies only the visual model, interaction model, and underlying data
schema.

---

## 2. Scope of Hierarchies Represented

The datacenter topology contains eight coexisting structures. This specification's ring/link model covers the first
three, which are genuine (near-)hierarchies. The remaining five are categorizations represented through node/link
attributes (color, pattern, stroke) instead. See §7.

**In scope for ring + link geometry:**

1. Physical containment (region → pod → rack → server)
2. Data fabric routing hierarchy (super-spine → spine → data leaf → server)
3. Management fabric routing hierarchy (mgmt-super-spine → mgmt-spine → mgmt leaf → server)

**Out of scope for geometry (deferred to attributes, see §7):**

4. OOB / break-glass hierarchy
5. Trust / administrative domain
6. Failure-domain hierarchy
7. BGP / routing-policy aggregation domain
8. Border / external connectivity (lateral, not tiered)

---

## 3. Ring Model

### 3.1 Ring Set

| Ring (inner → outer) | Generic label                | Populated in                                             |
|----------------------|------------------------------|----------------------------------------------------------|
| R0                   | Region                       | D only (otherwise omitted)                               |
| R1                   | Pod                          | B, C, D (omitted in A)                                   |
| R2                   | Tier-1 (Super-spine / Core)  | C (rare), D                                              |
| R3                   | Tier-2 (Spine / Aggregation) | B (as ToR pair, see §3.3), C, D                          |
| R4                   | Tier-3 (Leaf / Access)       | C, D (A/B collapse into R3, see §3.3)                    |
| R5                   | Rack                         | A, B, C, D                                               |
| R6                   | Server                       | A, B, C, D (always populated — universal outermost ring) |

Rings are generic so that every deployment option (A–D) is represented by the same visualization model. Empty rings are
omitted, allowing adjacent populated rings to remain contiguous.

### 3.2 Ring Independence

Each populated ring is laid out independently.

- Node ordering is determined only by that ring's layout pass.
- Empty rings are omitted.
- Only inter-ring parent/child links are rendered.

### 3.3 Per-option ring population (collapse rules)

| Option                  | Populated rings                                                                                            | Notes                                                                                                                                                           |
|-------------------------|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **A** (very small)      | R5 (Rack, single ring segment), R6 (Server)                                                                | Single managed switch is drawn as an **R5 rack-attribute** (a switch icon/badge on the rack arc), not a separate ring — there is no tier structure to speak of. |
| **B** (small resilient) | R1 (Pod, may be a single pod), R3 (ToR pair, labeled "Tier-2 / ToR"), R5, R6                               | R4 (Leaf) is **not separately populated** — ToR occupies the R3 slot directly, since B has no distinct leaf/spine split. R2 is omitted.                         |
| **C** (leaf-spine pod)  | R1, R2 (only if super-spine present within a large pod — otherwise omitted), R3 (Spine), R4 (Leaf), R5, R6 | Full generic stack minus Region.                                                                                                                                |
| **D** (multi-pod)       | R0, R1, R2, R3, R4, R5, R6                                                                                 | Full generic stack.                                                                                                                                             |

---

## 4. Node Model

### 4.1 Node types by ring

| Ring      | Node represents                                            | Cardinality note                                                                        |
|-----------|------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| R0 Region | A campus/region controller scope                           | Root, at most one per rendered graph                                                    |
| R1 Pod    | A self-contained routed fabric block                       | One arc per pod                                                                         |
| R2 Tier-1 | A super-spine / core switch                                | One arc per physical device                                                             |
| R3 Tier-2 | A spine switch, or a ToR switch in Option B                | One arc per physical device                                                             |
| R4 Tier-3 | A leaf switch (data or management, see §4.3)               | One arc per physical device                                                             |
| R5 Rack   | A rack (logical + physical unit; MAAS rackd-managed group) | One arc per rack                                                                        |
| R6 Server | A server, including GPU/accelerator nodes                  | One arc per physical server; DPUs are a server attribute, not a separate arc (see §7.5) |

### 4.2 Node attributes (common schema)

Every node, regardless of ring, carries:

```
{
  id: string,               // stable unique identifier
  ring: R0..R6,
  label: string,
  weight: number,           // drives arc angular width, see §5.2
  plane: "data" | "mgmt" | "shared" | "n/a",   // §4.3
  trust_tier: "operator" | "tenant" | "workload" | "n/a",  // §7.2
  failure_domain_role: "spof" | "redundant" | "n/a",       // §7.3
  metadata: { ... }         // free-form, for tooltips/detail panel
}
```

### 4.3 The `plane` attribute

Rings R2–R4 contain independent data-plane and management-plane nodes. R5 and R6 are shared physical infrastructure and
may receive links from both planes simultaneously. Plane membership is represented by the `plane` attribute and controls
coloring, filtering, and link generation throughout the visualization.

---

## 5. Layout Algorithm

### 5.1 Radial layer assignment

Each node is assigned to its configured ring according to §3.3. Ring assignment is static and independent of layout
optimization.

### 5.2 Angular position and arc width within a ring

For each ring, independently:

1. Compute `weight` per node. Default weight = **deduplicated downstream server count** (a rack served by two leaves
   counts its servers once, not twice, when computing the leaf arcs' widths). Alternative weight modes (bandwidth-sum,
   raw device count) are configurable per §9.2.
2. Order nodes within the ring to **minimize link crossings** to the adjacent (parent) ring — this is the radial
   analogue of the classic Sugiyama crossing-minimization step (barycenter or median heuristic, applied per ring pass,
   working inward from the outermost populated ring toward R0, then refined in a second outward pass).
3. Assign angular span proportional to weight, with a fixed minimum arc width so that low-weight nodes remain
   clickable/hoverable.
4. Leave a small fixed angular gutter between sibling arcs and a larger gutter between groups that share a common
   parent, to visually pre-group children before links are drawn.
5. R4 leaf nodes are positioned using the circular mean of the rack angles they serve, minimizing rack-to-leaf curvature
   while correctly handling the 0/2π seam.

### 5.3 Radii

Ring radii are fixed proportions of the available chart radius. Omitted rings consume no radial space. Labels degrade to
hover-only when the available arc length falls below the configured threshold (§8.4).

---

## 6. Edge / Link Model

### 6.1 What a link represents

Links are drawn only between nodes in adjacent rings. The following are never drawn:

- Same-ring links.
- Skip links between non-adjacent rings — the routing path through intermediate rings already expresses the
  relationship (e.g. pod→spine→leaf→rack renders pod→rack containment implicitly).
- Forbidden adjacencies — rendered separately as a distinct glyph when needed (see §7.6), not as a normal link.

Rack→server containment links (R5→R6) are the only physical containment links rendered; all other containment is
expressed through the routing hierarchy.

### 6.2 Link color (plane encoding)

Link colors use Canonical/Ubuntu brand palette values at specific tint percentages, not arbitrary CSS opacity fades, so
every shade remains "on-palette."

| Plane                    | Resting color                               | Hover / focus color                     | Notes                                                       |
|--------------------------|---------------------------------------------|-----------------------------------------|-------------------------------------------------------------|
| **Data**                 | `#F08D6A` (Ubuntu Orange at ~67% tint)      | `#E95420` (Ubuntu Orange full strength) | Active routing fabric                                       |
| **Management**           | `#A4708C` (Aubergine at ~67% tint)          | `#772953` (Aubergine full strength)     | Control / OOB-adjacent fabric                               |
| **Shared / containment** | `#D8D1CA` (Canonical warm grey, light tint) | `#AEA9A5` (warm grey mid)               | Physical containment skeleton (rack→server only — see §6.1) |

Ring arc fills use a graduated warm grey scale (lighter toward the outer server ring) so the palette does not compete
with link colors: R1 `#D6CFC9` → R3 `#DEDAD4` → R4 `#E3DDD8` → R5 `#E8E2DC` → R6 `#EDE8E3`.

### 6.3 Link weight / stroke width

Resting stroke width is **1 px** (uniform) across all links. On hover/focus, highlighted (lineage) links increase to *
*1.5 px** to reinforce the selection signal alongside the color change to full-strength brand colors. Bandwidth-weighted
stroke is available as an alternate mode (§9.2) for network-engineering-focused views.

### 6.4 Link path geometry

Links follow a circular dendrogram path consisting of:

- Radial segment from source node to the inter-ring gap midpoint (arc entry point).
- Circular arc at the inter-ring gap midpoint, sweeping from source angle to target angle.
- Radial segment from the arc exit point into the target node.

All link segments are therefore radial or circular. Explicit edge bundling or angular deflection is not part of this
specification.

### 6.5 Multi-parent rendering

Multi-parent relationships require no special rendering. Each parent-child relationship is rendered independently using
the geometry defined in §6.4.

---

## 7. Categorization Layer (Out-of-Ring-Geometry Structures)

Structures 4–8 from §2 are represented as **attributes on existing nodes/links**, not as new rings or independent link
sets. This section specifies their encoding.

### 7.1 OOB / break-glass hierarchy

Rendered as a sparse, independent link set (own color, §6.2) touching only console-port-bearing nodes. Should visually
read as barely present against the data/mgmt density — this is intentional.

### 7.2 Trust / administrative domain

Rendered as arc **fill pattern or border style** on R5/R6 nodes (e.g. solid border = operator-controlled, dashed
border = tenant-controlled bare-metal, hatched fill = workload endpoint). Never rendered as a link — see §7.6.

### 7.3 Failure-domain hierarchy

Rendered as a node-level severity indicator (e.g. a small badge or outer-ring tick) on R5 distinguishing
single-leaf-rack (failure domain = rack) from dual-leaf-rack (failure domain = leaf).

### 7.4 BGP / routing-policy aggregation domain

Rendered as a subtle background wedge or radial guide line at rack/pod boundaries where prefix aggregation occurs,
toggleable, off by default.

### 7.5 Border leaf / external connectivity

Rendered as a **satellite glyph** breaking radially inward from the pod arc at R1, past the inner edge of R0/Region (or
past the chart center if R0 is not populated). DPUs render as a small badge on the server arc rather than a separate
arc.

### 7.6 Forbidden adjacencies

Rendered as a distinct dashed/red "null link" glyph on hover or in an explicit "show constraints" mode — off by default.

---

## 8. Interaction Model

### 8.1 Option / scale selection

A primary control (slider or discrete selector, A–D) switches the active per-option ring population and collapse rules (
§3.3). Transitions should animate ring insertion/removal and arc re-proportioning rather than hard-cutting.

### 8.2 Plane toggle

Independent show/hide toggles for **Data**, **Management**, and **Containment** (rack→server physical skeleton) link
sets, each toggleable without affecting ring/node geometry — only link visibility changes. Default state: all three on.
A fourth toggle for OOB should be added (default off) when OOB links are implemented.

### 8.3 Hover / focus behavior

Hovering a node highlights its complete ancestor lineage by traversing all incoming links toward lower ring depths.
Because the topology permits multiple parents, the highlighted lineage is generally a connected subgraph rather than a
single path.

**What is highlighted:**

- Every ancestor node arc (full opacity).
- Every drawn link whose both endpoints are within the lineage node set (full-strength brand stroke color,
  `stroke-width` 1.5 px, raised to front of the SVG link layer).

**What is dimmed:**

- All node arcs not in the lineage set (opacity 0.07).
- All links not in the lineage link set (opacity 0.07, `stroke-width` 1 px).

**Example — hovering a rack (R5):** the rack's leaf parents (R4), all spines connected to those leaves (R3), and the
pod (R1) are illuminated, along with every leaf→rack, spine→leaf, and pod→spine link that connects them. Servers and
other racks are dimmed.

On mouse leave, all arcs and links return to their resting state (tint colors, uniform `stroke-width` 1 px).

### 8.4 Label degradation

At small arc widths, labels move from always-on to hover/click-triggered tooltip, so the ring geometry stays legible at
Option D scale without text collision.

### 8.5 Drill / filter

Clicking a pod or rack arc can optionally filter the visualization to that subtree (all rings recompute weights/angles
relative to the selected node's descendants only) — useful for inspecting a single rack's dual-plane, dual-leaf
structure in isolation at Option C/D scale.

---

## 9. Data Schema

### 9.1 Minimal graph schema

```json
{
  "nodes": [
    {
      "id": "rack-14",
      "ring": "R5",
      "label": "Rack 14",
      "weight": 12,
      "plane": "shared",
      "trust_tier": "operator",
      "failure_domain_role": "redundant",
      "metadata": {}
    }
  ],
  "links": [
    {
      "source": "leaf-data-14a",
      "target": "rack-14",
      "plane": "data",
      "type": "routing_adjacency",
      "weight": 1
    },
    {
      "source": "leaf-data-14b",
      "target": "rack-14",
      "plane": "data",
      "type": "routing_adjacency",
      "weight": 1
    }
  ]
}
```

The two links into `rack-14` demonstrate the dual-leaf case rendered natively, with no schema-level special case
required.

### 9.2 Configuration parameters

| Parameter                      | Default                     | Purpose                            |
|--------------------------------|-----------------------------|------------------------------------|
| `weight_mode`                  | `deduplicated_server_count` | Arc sizing metric (§5.2)           |
| `stroke_mode`                  | `uniform`                   | Alternate: `bandwidth_weighted`    |
| `min_arc_width_px`             | implementation-defined      | Floor for tiny-weight nodes (§5.2) |
| `label_collision_threshold_px` | implementation-defined      | Trigger for §8.4 degradation       |

---

## 10. Future Work

1. **Crossing-minimization refinement.** The current layout uses a single-pass barycenter heuristic (§5.2). Full
   multi-pass convergence across simultaneously-optimized rings is deferred until a working deployment demonstrates
   whether the simpler heuristic produces visually disruptive crossings in practice.

2. **Border-leaf visualization at large pod counts (Option D).** The satellite glyph approach (§7.5) may collide at high
   pod density. A candidate direction is depth-stacking each pod as its own radial disc along a z-axis, with Region (R0)
   as a shared axis. Navigation model, occlusion, and cross-disc link routing remain open.

3. **Whether Option A merits a simplified presentation.** With R1–R4 empty, the ring model produces a mostly-empty
   center. A non-radial fallback card for Option A may be more appropriate, but this is low-risk to defer until the
   other options are validated.

---

## 11. Visual Design Reference

Visual decisions from the Option C implementation, for consistency when extending to additional options or integrating
into a product UI.

### 11.1 Typography

- **Primary typeface:** Ubuntu (weights 300, 400, 500, 700) for all UI text — titles, ring labels, legend, tooltips.
- **Monospace:** Ubuntu Mono (400, 700) for R5 rack and R6 server arc labels.
- **Delivery:** Google Fonts CDN (`@import` at the top of the CSS, family: `Ubuntu` + `Ubuntu Mono`). Fallback stack:
  `"Ubuntu", system-ui, sans-serif`.

### 11.2 Ring arc geometry (Option C)

| Ring      | Inner radius (px) | Outer radius (px) | Fill colour |
|-----------|-------------------|-------------------|-------------|
| R1 Pod    | 38                | 82                | `#D6CFC9`   |
| R3 Spine  | 100               | 152               | `#DEDAD4`   |
| R4 Leaf   | 170               | 234               | `#E3DDD8`   |
| R5 Rack   | 252               | 304               | `#E8E2DC`   |
| R6 Server | 322               | 420               | `#EDE8E3`   |

Inter-ring gaps (18–20 px each) are left clear — link arcs float at each gap's midpoint radius.

### 11.3 Legend and controls

- **Plane toggle bar** (above chart): flat pill buttons labeled "Data", "Management", "Containment". Active state uses
  full-strength brand color fill. All three on by default.
- **Ring depth legend** (below chart): coloured chips matching ring arc fills, connected by `→` arrows, reading Pod →
  Spine → Leaf → Rack → Server. Static, not interactive.
- **Chart title:** "Datacenter Network Topology", with an Ubuntu-Orange underline accent. Subtitle: "Option C · Standard
  Leaf-Spine Pod · Radial Layered Graph".

### 11.4 Implementation status notes

- **Border-leaf satellite glyph (§7.5):** not rendered. The border-leaf node carries `ring: "SAT"` and is excluded from
  layout and link drawing. Deferred.
- **Label degradation (§8.4):** not implemented at Option C scale. Server arcs at R6 are approximately 63 px arc-length
  at mid-ring radius — sufficient for a short monospace label. Implement when extending to larger options or denser
  fixtures.

