# Specification: Radial Layered (Sugiyama) Dendrogram Graph

### Datacenter Network Topology Visualization

**Status:** Final
**Scope:** Visual design and data model. Does not specify a rendering framework or implementation stack.
**Reference basis:** Reference deployment options A–D (small deployment → large multi-pod datacenter), as established in
prior design discussion.

---

## 1. Purpose

This visualization represents datacenter topologies containing multiple overlapping routing and containment hierarchies
while preserving explicit parent-child connectivity. Nodes occupy fixed concentric rings representing hierarchy depth,
while relationships are expressed through explicit inter-ring links in addition to geometric proximity between ring
layers. The model supports multiple parents per node, redundant routing paths, and multiple coexisting network planes
without duplicating physical infrastructure.

The visualization is implementation-agnostic and specifies only the visual model, interaction model, and underlying data
schema.

---

## 2. Scope of Hierarchies Represented

The datacenter topology contains nine coexisting structures. This specification's ring/link model covers the first
three, which are genuine (near-)hierarchies. The remaining six are categorizations represented through node/link
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
8. Border leaf (`leaf_role: "border"`) is an ordinary Tier-3 (Leaf) ring member (§4.3, §7.5) — its role as an
   external/WAN/DCI connectivity point is conveyed entirely through the node's own attribute styling. No separate
   link, glyph, or ring geometry represents the external reach itself.
9. Same-tier peer adjacency (e.g. a ToR-to-ToR link in Option B) — the nodes
   are ordinary ring members; the peer link itself is an attributed exception
   to normal ring linking, see §6.1a.

---

## 3. Ring Model

### 3.1 Ring Set

| Ring (inner → outer) | Generic label                                            |
|-----------------------|----------------------------------------------------------|
| R0                    | Region                                                   |
| R1                    | Pod                                                      |
| R2                    | Tier-1 (Super-spine / Core)                              |
| R3                    | Tier-2 (Spine / Aggregation)                             |
| R4                    | Tier-3 (Leaf / Access — includes Border Leaf, see §4.3)  |
| R5                    | Rack                                                     |
| R6                    | Server                                                   |

Rings are generic so that every deployment option (A–D) is represented by the same visualization model. Empty rings are
omitted, allowing adjacent populated rings to remain contiguous.

### 3.2 Ring Independence

Each populated ring is laid out independently.

- Node ordering is determined only by that ring's layout pass.
- Empty rings are omitted.
- Parent/child links are rendered between adjacent rings; same-ring peer links are also permitted as an explicit,
  visually-distinct exception (§6.1a) — they do not affect ring layout or angular assignment.

### 3.3 Per-option ring population (collapse rules)

| Option                  | Populated rings                                                                                            | Notes                                                                                                                                                           |
|-------------------------|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **A** (very small)      | R5 (Rack, single ring segment), R6 (Server)                                                                | Single managed switch is drawn as an **R5 rack-attribute** (a switch icon/badge on the rack arc), not a separate ring — there is no tier structure to speak of. |
| **B** (small resilient) | R1 (Pod, may be a single pod), R3 (ToR pair, labeled "Tier-2 / ToR"), R5, R6                               | R4 (Leaf) is **not separately populated** — ToR occupies the R3 slot directly, since B has no distinct leaf/spine split. R2 is omitted. The two ToR nodes carry an explicit same-ring peer link (§6.1a) representing their direct uplink/adjacency. |
| **C** (leaf-spine pod)  | R1, R2 (only if super-spine present within a large pod — otherwise omitted), R3 (Spine), R4 (Leaf, including Border Leaf, see §4.3), R5, R6 | Full generic stack minus Region.                                                                                                                                |
| **D** (multi-pod)       | R0, R1, R2, R3, R4 (Leaf, including Border Leaf, see §4.3), R5, R6                                         | Full generic stack.                                                                                                                                             |

---

## 4. Node Model

### 4.1 Node types by ring

| Ring      | Node represents                                            | Cardinality note                                                                        |
|-----------|------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| R0 Region | A campus/region controller scope                           | Root, at most one per rendered graph                                                    |
| R1 Pod    | A self-contained routed fabric block                       | One arc per pod                                                                         |
| R2 Tier-1 | A super-spine / core switch                                | One arc per physical device                                                             |
| R3 Tier-2 | A spine switch, or a ToR switch in Option B                | One arc per physical device; ToR pairs in Option B may carry a same-ring peer link (§6.1a) |
| R4 Tier-3 | A leaf switch — data, management, or border (external/WAN/DCI role), see §4.3 | One arc per physical device                                                             |
| R5 Rack   | A rack (logical + physical unit; MAAS rackd-managed group) | One arc per rack                                                                        |
| R6 Server | A server, including GPU/accelerator nodes                  | One arc per physical server; DPUs are a server attribute, not a separate arc            |

### 4.2 Node attributes (common schema)

Every node, regardless of ring, carries:

```
{
  id: string,               // stable unique identifier
  ring: R0..R6,
  label: string,
  weight: number,           // drives arc angular width, see §5.2
  plane: "data" | "mgmt" | "shared" | "n/a",               // §4.3
  leaf_role: "access" | "border" | "n/a",                  // R4 only, §4.3/§7.5; "n/a" for all other rings
  trust_tier: "operator" | "tenant" | "workload" | "n/a",  // §7.2 — this is the single source of truth for the enum
  failure_domain_role: "spof" | "redundant" | "n/a",       // §7.3 — this is the single source of truth for the enum
  metadata: { ... }         // free-form, for tooltips/detail panel
}
```

### 4.3 The `plane` and `leaf_role` attributes

Rings R2–R4 contain independent data-plane and management-plane nodes. R5 and R6 are shared physical infrastructure and
may receive links from both planes simultaneously. Plane membership is represented by the `plane` attribute and controls
coloring, filtering, and link generation throughout the visualization. Per-plane node **fill** tinting (Data leaves/
spines shaded toward the Data hue, Management leaves/spines shaded toward the Management hue, both at a low tint over
the dark-mode ring base) is specified once, in §11.3 — not repeated here.

Within R4, `leaf_role` distinguishes ordinary access/fabric leaves (`"access"`) from Border Leaves (`"border"`). A
Border Leaf is a normal R4 ring member — same ring band, same spine-adjacency link rules, same weight/angle layout
pass as any other leaf (§4.1) — it is **not** a separate ring or a satellite glyph (superseding the earlier
satellite-glyph approach; see §7.5). Border Leaves receive their own dedicated fill color (distinct from both the
Data and Management tints, §11.3) so they remain visually identifiable within the R4 ring regardless of which plane
they're associated with.

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
2. Order nodes within the ring to **minimize link crossings** to the adjacent (parent) ring. This is the radial
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

Links are drawn between nodes in adjacent rings by default. The following are never drawn:

- Skip links between non-adjacent rings — the routing path through intermediate rings already expresses the
  relationship (e.g. pod→spine→leaf→rack renders pod→rack containment implicitly).
- Forbidden adjacencies — rendered separately as a distinct glyph when needed (see §7.6), not as a normal link.

Rack→server containment links (R5→R6) are the only physical containment links rendered; all other containment is
expressed through the routing hierarchy.

#### 6.1a Same-ring peer links (exception)

Same-ring links are permitted for one purpose only: representing a direct physical/logical **peer adjacency** between
two devices at the same tier that is not itself a parent-child routing relationship — for example the ToR-to-ToR
uplink in Option B (§3.3), or an analogous leaf-to-leaf/spine-to-spine peer link if a future option requires one.

- Link `type: "peer_adjacency"`, restricted to source and target sharing the same `ring`.
- Path geometry follows the **same radial/circular dendrogram path grammar as standard inter-ring links** (§6.4):
  a radial segment from the source node out to a gap midpoint, a circular arc sweeping from source angle to target
  angle, and a radial segment back in to the target node. Since there is no adjacent ring to supply a natural gap,
  the gap midpoint is a small fixed radial offset just outside the ring's own outer radius (a "virtual ring" one
  gutter-width beyond the ring band).
- Color is the only differentiator from routing links: link color lookup is keyed by `type`, not `plane` — a
  `peer_adjacency` link always resolves to the dedicated "Peer adjacency" color pair in §6.2, even though its `plane`
  value remains `"shared"` for schema consistency with other physical-layer links (§9.1). No dash pattern is used.
- Does not affect ring layout, angular assignment, or crossing-minimization (§5.2) for either endpoint ring.
- Multiplicity: expected to be sparse (typically one peer link per redundant pair), so no bundling behavior is
  specified.

### 6.2 Link color (plane/type encoding — dark theme)

The visualization uses a **dark canvas** (§11.1) while remaining strictly on the Canonical/Ubuntu brand palette.
Link colors use brand hues lifted to saturated mid-tones chosen for contrast and visual "pop" against the dark
background — resting states are vivid dark tints of each brand color (not washed-out/desaturated), hover/focus states
jump to the vivid full-strength brand color, which reads clearly on dark surfaces. Color is resolved by `plane` for
routing/containment links, and by `type` for the `peer_adjacency` exception (§6.1a), whose `plane` value stays
`"shared"` for schema consistency but must not be color-matched to plain containment links.

| Plane / type              | Resting color (on dark canvas)          | Hover / focus color                          | Notes                                                       |
|----------------------------|-------------------------------------------|-----------------------------------------------|-------------------------------------------------------------|
| **Data**                  | `#C1501F` (Ubuntu Orange, vivid dark tint)| `#E95420` (Ubuntu Orange full strength)      | Active routing fabric                                       |
| **Management**            | `#9C3D72` (Aubergine, vivid dark tint)    | `#D98AB5` (Aubergine, lightened for dark-bg contrast) | Control / OOB-adjacent fabric                  |
| **Shared / containment**  | `#8C8579` (warm grey, lightened for visibility) | `#D8D1CA` (warm grey, lightened further) | Physical containment skeleton (rack→server, §6.1); `type: "containment"` only |
| **Peer adjacency**        | `#B68720` (Ubuntu Yellow/gold, vivid dark tint) | `#EFB73E` (Ubuntu Yellow/gold full strength) | `type: "peer_adjacency"` only (§6.1a) — a distinct hue so a ToR-to-ToR link is never mistaken for containment or routing, despite sharing `plane: "shared"` |

Ring/node arc fill colors — including the plane-tinted Data/Management leaf and spine fills and the dedicated Border
Leaf fill — are specified once, in §11.3 (the canonical, authoritative table for all rings) — not repeated here.

### 6.3 Link weight / stroke width

Resting stroke width is **1 px** (uniform) across all links. On hover/focus, highlighted (lineage) links increase to *
*1.5 px** to reinforce the selection signal alongside the color change to full-strength brand colors. Bandwidth-weighted
stroke is available as an alternate mode (§9.2) for network-engineering-focused views.

### 6.4 Link path geometry

All links — standard inter-ring links and the same-ring peer-adjacency exception alike (§6.1a) — follow the same
circular dendrogram path grammar:

- Radial segment from source node to the gap midpoint (arc entry point).
- Circular arc at the gap midpoint, sweeping from source angle to target angle.
- Radial segment from the arc exit point into the target node.

For standard links the gap midpoint sits between two adjacent populated rings; for same-ring peer links (§6.1a) it
sits at a small fixed radial offset just outside the shared ring's own outer radius. All link segments are therefore
radial or circular in every case. Explicit edge bundling or angular deflection is not part of this specification.
Where multiple links from different plane/type lanes would otherwise coincide in the same gap, each lane is offset by
a small fixed radial amount rather than sharing one path — see §6.6.

### 6.5 Multi-parent rendering

Multi-parent relationships require no special rendering. Each parent-child relationship is rendered independently using
the geometry defined in §6.4.

### 6.6 Parallel lane offset ("cable" rendering)

Within any single inter-ring gap (or virtual gap, for peer-adjacency links, §6.1a), links belonging to different
plane/type lanes are offset from the gap's nominal midpoint radius so that parallel links form a visually distinct
"cable" of parallel strands rather than overlapping into a single indistinguishable stroke. This most commonly occurs
where a Data leaf and its paired Management leaf serve the same rack at (near-)identical angular position (§5.2 step
5's data/mgmt interleaving), causing their respective rack-bound links to otherwise sit directly on top of one
another.

- Each lane is assigned a fixed radial offset of **1–2 px** from the gap midpoint, ordered consistently across the
  whole chart: Data lane innermost (gap midpoint − 1.5 px), Management lane outermost (gap midpoint + 1.5 px),
  Containment lane centered (at the gap midpoint, since it never coexists with Data/Management links in the same
  gap), Peer-adjacency lane at its own virtual-gap midpoint ± 1 px when more than one peer link shares a ring (rare).
- The offset applies to the **circular arc segment only** — the radial entry/exit segments still terminate exactly
  at each node's own angular position, so the parallel-lane effect is visible mid-gap without altering where a link
  visually attaches to its node.
- Offsets are fixed pixel values, not proportional to chart radius, so the "cable" spacing reads consistently at
  every ring depth and every option's chart scale.
- This is purely a rendering offset — it does not change link semantics, hover/lineage lookup (§8.3), or the
  underlying data schema (§9.1).

---

## 7. Categorization Layer (Out-of-Ring-Geometry Structures)

Structures 4, 5, 6, 7 and 9 from §2 are represented as **attributes on existing nodes/links**, not as new rings or
independent link sets (structure 9's peer link is the one attributed exception that *is* a link, specified in §6.1a).
This section specifies their encoding.

### 7.1 OOB / break-glass hierarchy

Rendered as a sparse, independent link set (own color, distinct from §6.2's plane palette) touching only
console-port-bearing nodes. Should visually read as barely present against the data/mgmt density — this is
intentional.

### 7.2 Trust / administrative domain

Rendered as arc **fill pattern or border style** on R5/R6 nodes. Valid values and their encoding: `"operator"` = solid
border, `"tenant"` = dashed border (tenant-controlled bare-metal), `"workload"` = hatched fill (workload endpoint). The
enum itself is defined once, in §4.2 — this section only specifies the visual encoding, not the value set. Never
rendered as a link — see §7.6.

### 7.3 Failure-domain hierarchy

Rendered as a node-level severity indicator (e.g. a small badge or outer-ring tick) on R5, keyed off the
`failure_domain_role` enum defined in §4.2: `"spof"` = single-leaf-rack (failure domain = rack), `"redundant"` =
dual-leaf-rack (failure domain = leaf).

### 7.4 BGP / routing-policy aggregation domain

Rendered as a subtle background wedge or radial guide line at rack/pod boundaries where prefix aggregation occurs,
toggleable, off by default.

### 7.5 Border leaf (`leaf_role: "border"`)

The Border Leaf is an **ordinary R4 ring member** (§3.1, §4.1, §4.3) — it participates in normal spine-adjacency
routing links, normal weight-proportional angular sizing, and normal crossing-minimization, identically to an
access-role leaf. It is distinguished from access leaves by two additive attributes: its own dedicated **fill color**
(distinct from both the Data and Management tints, §11.3 — since a border leaf is not itself plane-exclusive) and the
`trust_tier`-driven border/hatch treatment from §7.2, layered on top. Its role as an
external/WAN/DCI connectivity point for the fabric is conveyed by this styling alone — no separate link, satellite
glyph, or center-directed connection is rendered; the node's presence and styling already imply the external reach.

DPUs continue to render as a small badge on the server arc rather than a separate arc.

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
A fourth toggle for OOB should be added (default off) when OOB links are implemented. (Visual/UI treatment of these
toggles — button style, placement — is specified once, in §11.4; not repeated here.)

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
      "leaf_role": "n/a",
      "trust_tier": "operator",
      "failure_domain_role": "redundant",
      "metadata": {}
    },
    {
      "id": "leaf-data-14a",
      "ring": "R4",
      "label": "Data Leaf 14a",
      "weight": 12,
      "plane": "data",
      "leaf_role": "access",
      "trust_tier": "operator",
      "failure_domain_role": "n/a",
      "metadata": {}
    },
    {
      "id": "border-leaf-1",
      "ring": "R4",
      "label": "Border Leaf 1",
      "weight": 1,
      "plane": "data",
      "leaf_role": "border",
      "trust_tier": "operator",
      "failure_domain_role": "n/a",
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
    },
    {
      "source": "tor-1",
      "target": "tor-2",
      "plane": "shared",
      "type": "peer_adjacency",
      "weight": 1
    }
  ]
}
```

The two `routing_adjacency` links into `rack-14` demonstrate the dual-leaf case rendered natively, with no
schema-level special case required. `border-leaf-1` demonstrates the Border Leaf as an ordinary R4 node (§4.3, §7.5):
it takes normal spine-adjacency `routing_adjacency` links (not shown above) exactly like `leaf-data-14a` — no
additional external-connectivity link is needed, since the `leaf_role: "border"` attribute alone conveys its
external/WAN/DCI role. The `tor-1`/`tor-2` pair demonstrates the same-ring `peer_adjacency` exception (§6.1a) used in
Option B, rendered with the standard dendrogram path grammar (§6.4) and a distinct plane color (§6.2).

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

2. **Border-leaf visual salience at large pod/leaf counts (Option D).** Now that the Border Leaf is an ordinary R4
   node distinguished only by the `leaf_role: "border"` attribute (§4.3, §7.5), the open question is whether its
   attribute styling (arc border/hatch) remains legible when many leaves are packed into a dense R4 ring at Option D
   scale, or whether it needs a stronger visual treatment (e.g. a bolder outline) at high leaf density.

3. **Whether Option A merits a simplified presentation.** With R1–R4 empty, the ring model produces a mostly-empty
   center. A non-radial fallback card for Option A may be more appropriate, but this is low-risk to defer until the
   other options are validated.

---

## 11. Visual Design Reference

Visual decisions from the Option C implementation, for consistency when extending to additional options or integrating
into a product UI.

### 11.1 Color mode: dark theme

The visualization uses a **dark canvas**, on the Canonical/Ubuntu dark-theme surface palette, rather than a light
background. This governs every other color decision in this section and in §6.2.

| Surface                     | Color       | Notes                                                            |
|------------------------------|-------------|-------------------------------------------------------------------|
| Chart background / canvas   | `#151515`   | Canonical dark-theme base surface                                |
| Chart panel / card surface  | `#1E1E1E`   | Slightly lighter than canvas, for the chart's containing panel   |
| Primary text                | `#F7F7F7`   | Titles, labels, legend text                                      |
| Secondary / muted text      | `#9C948C`   | De-emphasized text (e.g. dimmed labels, helper copy)             |

All ring/node fills (§11.3) and link colors (§6.2) are chosen against this base so that brand hues (Ubuntu Orange,
Aubergine, warm gold) remain legible and on-palette on a dark surface, rather than the light-surface tints used in
earlier drafts of this spec.

### 11.2 Typography

- **Primary typeface:** Ubuntu (weights 300, 400, 500, 700) for all UI text — titles, ring labels, legend, tooltips.
- **Monospace:** Ubuntu Mono (400, 700) for R5 rack and R6 server arc labels.
- **Delivery:** Google Fonts CDN (`@import` at the top of the CSS, family: `Ubuntu` + `Ubuntu Mono`). Fallback stack:
  `"Ubuntu", system-ui, sans-serif`.
- Text color follows §11.1 (`#F7F7F7` primary, `#9C948C` secondary) rather than a dark-on-light scheme.

### 11.3 Ring/node arc geometry and fill (Option C) — canonical reference

This table is the **single source of truth** for ring/node arc fill colors (referenced from §6.2, §4.3, §7.5) as well
as radii; values are not restated elsewhere.

Two fill families are used:

1. **Neutral (containment-only) rings** — R1 Pod, R5 Rack, R6 Server carry no single plane, so they use a graduated
   dark-neutral scale (base: Canonical warm grey `#AEA9A5`, blended dark for the dark canvas), lighter toward the
   outer server ring so depth still reads as a visual gradient without competing with link colors.
2. **Plane-tinted (routing) rings** — R2/R3/R4 nodes are shaded toward their own `plane` hue at a **saturated, vivid
   tint over the dark base** (not washed-out/desaturated), rather than the flat neutral fill: Data nodes lean toward
   Ubuntu Orange, Management nodes toward Aubergine. This lets a hovering eye associate a leaf/spine arc with its
   plane before even reading a link color. Border Leaves (`leaf_role: "border"`, §4.3/§7.5) use a **third, dedicated
   fill** — Ubuntu Sage — so they remain visually distinct from both planes regardless of which plane they're tagged
   with.

| Ring / role                     | Inner radius (px) | Outer radius (px) | Fill colour | Notes                                   |
|----------------------------------|--------------------|--------------------|-------------|-------------------------------------------|
| R1 Pod (neutral)                 | 38                 | 82                 | `#2E2C2A`   | Darkest neutral — innermost visual anchor |
| R3 Spine — Data plane             | 100                | 152                | `#572A19`   | Vivid Ubuntu Orange tint over dark base    |
| R3 Spine — Management plane       | 100                | 152                | `#4A1C39`   | Vivid Aubergine tint over dark base        |
| R4 Leaf — Data plane, access      | 170                | 234                | `#6B331F`   | Vivid Ubuntu Orange, slightly lighter than R3 (outward gradient) |
| R4 Leaf — Management plane, access| 170                | 234                | `#5C2347`   | Vivid Aubergine, slightly lighter than R3  |
| R4 Leaf — Border (`leaf_role: "border"`) | 170         | 234                | `#1F4725`   | Dedicated vivid Ubuntu Sage tint — distinct from both planes |
| R5 Rack (neutral)                 | 252                | 304                | `#3A3835`   | Mid neutral                                |
| R6 Server (neutral)               | 322                | 420                | `#454340`   | Lightest neutral — outermost, maximizes arc surface for labels |

Inter-ring gaps (18–20 px each) are left clear — link arcs float at each gap's midpoint radius (subject to the
per-lane offset in §6.6). Radii above are the Option C reference values; other options reuse the same fill colors per
ring/role but may need different radii if fewer rings are populated (§3.3) and available chart radius is
redistributed. R2 (Super-spine, populated only in rare Option C cases and in Option D) follows the same Data/
Management plane-tint rule as R3.

### 11.4 Legend and controls

- **Plane toggle bar** (above chart): flat pill buttons labeled "Data", "Management", "Containment", on the dark
  panel surface (§11.1). Behavior and default state are specified in §8.2 (not restated here).
- **Ring depth legend** (below chart): coloured chips matching ring/node arc fills (§11.3), connected by `→` arrows,
  reading Pod → Spine → Leaf → Rack → Server. Static, not interactive.
- **Chart title:** "Datacenter Network Topology", with an Ubuntu-Orange underline accent, set in the primary text
  color (§11.1). Subtitle: "Option C · Standard Leaf-Spine Pod · Radial Layered Graph", in the secondary/muted text
  color.

### 11.5 Implementation status notes

- **Border leaf as R4 ring member (§4.3, §7.5):** not yet rendered in the Option C fixture. The fixture's
  `border-leaf-1` node still needs migrating from a `ring: "SAT"` satellite stub to a normal `ring: "R4"` node with
  `leaf_role: "border"` and spine-adjacency links matching other R4 leaves — no additional link type is required, since
  the attribute alone conveys its external role. This migration is tracked as an open follow-up to this spec revision,
  not yet implemented in `data.js`/`layout.js`.
- **ToR peer link (§6.1a):** not applicable to the Option C fixture (Option B only); no fixture exists yet for Option B.
- **Plane-tinted fills and dark theme (§11.1, §11.3):** not yet implemented; the current Option C CSS/renderer still
  uses the earlier light-surface neutral fills and light-mode link colors. Migrating to the dark palette and
  plane-tinted node fills is tracked as an open follow-up.
- **Parallel lane offset (§6.6):** not yet implemented; the current renderer draws all links through a single shared
  gap-midpoint radius per ring gap.
- **Label degradation (§8.4):** not implemented at Option C scale. Server arcs at R6 are approximately 63 px arc-length
  at mid-ring radius — sufficient for a short monospace label. Implement when extending to larger options or denser
  fixtures.

