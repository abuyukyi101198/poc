# Specification: Radial Layered (Sugiyama) Graph with Hierarchical Edge Bundling
### Datacenter Network Topology Visualization

**Status:** Draft v0.1
**Scope:** Visual design and data model. Does not specify a rendering framework or implementation stack.
**Reference basis:** Reference deployment options A–D (small deployment → large multi-pod datacenter), as established in prior design discussion.

---

## 1. Purpose and Design Rationale

### 1.1 Problem being solved

A datacenter topology, as described in the reference architecture, is not a single tree. It is several coexisting hierarchies sharing a common set of physical anchors (rack, server), plus a set of cross-cutting categorizations that do not belong in any hierarchy at all. A strict containment diagram (e.g. a classic sunburst) can only faithfully represent structures with a single parent per node. The reference architecture violates this in two specific, load-bearing ways:

- **Dual-leaf racks**: a rack can be served by two leaf switches, not one.
- **ECMP leaf-spine fan-out**: a leaf switch connects to multiple spine switches by design, and the number of active equal-cost paths is itself meaningful information.

A layout that forces single-parent structure would either misrepresent these relationships or hide them behind non-structural annotation. This specification instead separates **position** (which ring a node sits in) from **relationship** (which links connect it to nodes in adjacent rings), so that multi-parent structures are drawn as what they are, rather than approximated.

### 1.2 Chosen technique

**Radial layered graph with hierarchical edge bundling**, i.e.:

- **Layered / Sugiyama-style layout**: nodes are assigned to discrete layers (here, concentric rings) by hierarchy depth, and edges run only between adjacent layers under normal conditions.
- **Radial arrangement**: layers are drawn as concentric rings rather than horizontal bands, preserving the large-arc-surface readability and color-coding density that motivated the original sunburst proposal.
- **Hierarchical edge bundling**: inter-ring edges that share source or destination regions are bundled into common paths that split apart only near their endpoints, keeping multi-parent and full-mesh regions (leaf-spine ECMP) legible instead of becoming a hairball.

### 1.3 What this design keeps from the original sunburst proposal, and what it changes

| Property | Sunburst (original) | This design |
|---|---|---|
| Ring = hierarchy depth | Yes | Yes, unchanged |
| Arc angular span = readable surface area | Yes | Yes, unchanged |
| Color coding on arcs | Yes | Yes, unchanged |
| Parent-child shown by angular nesting | Yes | **No** — angular position is independent per ring |
| Parent-child shown by drawn link | No (implicit in geometry) | **Yes** — explicit curve, can be one-to-many or many-to-many |
| Multiple parents per node | Not representable | Representable natively |
| Full mesh (ECMP) | Not representable | Representable, with bundling to control density |
| Two parallel hierarchies sharing one physical layer (data vs. management fabric) | Not representable without duplicating the whole chart | Representable as two independently colored, independently toggleable link sets over the shared physical rings |

---

## 2. Scope of Hierarchies Represented

Per prior analysis, the datacenter topology contains eight coexisting structures. This specification's ring/link model covers the first three, which are genuine (near-)hierarchies. The remaining five are categorizations, not hierarchies, and are explicitly out of scope for ring/link geometry — they are represented through node/link attributes (color, pattern, stroke) instead. See §7.

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

### 3.1 Ring set (generic, option-agnostic)

Rings are defined generically so that Options A–D are the *same* visualization with rings populated, collapsed, or omitted — not four different charts.

| Ring (inner → outer) | Generic label | Populated in |
|---|---|---|
| R0 | Region | D only (otherwise omitted) |
| R1 | Pod | B, C, D (omitted in A) |
| R2 | Tier-1 (Super-spine / Core) | C (rare), D |
| R3 | Tier-2 (Spine / Aggregation) | B (as ToR pair, see §3.3), C, D |
| R4 | Tier-3 (Leaf / Access) | C, D (A/B collapse into R3, see §3.3) |
| R5 | Rack | A, B, C, D |
| R6 | Server | A, B, C, D (always populated — universal outermost ring) |

Rings are drawn **innermost = region, outermost = server**, so that the ring holding the most individually-meaningful arcs — every server in every rack — gets the largest available radius and arc-length budget, maximizing per-server readability and color-coding surface area. This is the opposite radial direction from a standard containment sunburst (which typically grows outward from root to leaf in size-of-aggregate terms); here it is deliberately inverted because the design goal is per-server legibility at the perimeter, not root prominence at the center. It also matches the direction option scale increases outward from the core: A populates only R5–R6 near the middle-to-outer bands, D uses the full R0–R6 stack from center to edge.

### 3.2 Ring independence

Each ring is laid out independently:
- Arc order and spacing within a ring are determined by that ring's own layout pass (see §5), not inherited from ring position of parents or children.
- A ring may be entirely empty for a given option/site instance, in which case it is omitted and adjacent populated rings become radially adjacent (no dead radius band).
- Two nodes in the same ring never have a drawn relationship to each other — same-ring edges are not part of this model (e.g. leaf-to-leaf peer links, if they exist operationally, are out of scope here; only inter-ring parent/child relationships are drawn).

### 3.3 Per-option ring population (collapse rules)

| Option | Populated rings | Notes |
|---|---|---|
| **A** (very small) | R5 (Rack, single ring segment), R6 (Server) | Single managed switch is drawn as an **R5 rack-attribute** (a switch icon/badge on the rack arc), not a separate ring — there is no tier structure to speak of. |
| **B** (small resilient) | R1 (Pod, may be a single pod), R3 (ToR pair, labeled "Tier-2 / ToR"), R5, R6 | R4 (Leaf) is **not separately populated** — ToR occupies the R3 slot directly, since B has no distinct leaf/spine split. R2 is omitted. |
| **C** (leaf-spine pod) | R1, R2 (only if super-spine present within a large pod — otherwise omitted), R3 (Spine), R4 (Leaf), R5, R6 | Full generic stack minus Region. |
| **D** (multi-pod) | R0, R1, R2, R3, R4, R5, R6 | Full generic stack. |

This collapse rule is what lets a single spec (and a single implementation) render all four options without branching logic beyond "which rings have nodes."

---

## 4. Node Model

### 4.1 Node types by ring

| Ring | Node represents | Cardinality note |
|---|---|---|
| R0 Region | A campus/region controller scope | Root, at most one per rendered graph |
| R1 Pod | A self-contained routed fabric block | One arc per pod |
| R2 Tier-1 | A super-spine / core switch | One arc per physical device |
| R3 Tier-2 | A spine switch, or a ToR switch in Option B | One arc per physical device |
| R4 Tier-3 | A leaf switch (data or management, see §4.3) | One arc per physical device |
| R5 Rack | A rack (logical + physical unit; MAAS rackd-managed group) | One arc per rack |
| R6 Server | A server, including GPU/accelerator nodes | One arc per physical server; DPUs are a server attribute, not a separate arc (see §7.5) |

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

### 4.3 The `plane` attribute and dual-tree rings

R2, R3, R4 nodes must declare `plane: "data"` or `plane: "mgmt"`, because the data fabric and management fabric are structurally separate Clos fabrics that happen to terminate on the same rack/server rings. This means **R2–R4 rings can contain two disjoint sets of arcs** (a data-plane set and a management-plane set), visually distinguished by color family (§6.2) and independently toggleable (§8.2).

R5 (Rack) and R6 (Server) are `plane: "shared"` — a single physical rack/server arc receives links from both plane's link sets.

---

## 5. Layout Algorithm

### 5.1 Radial layer assignment

Standard Sugiyama layering, applied radially:
1. Assign each node a layer = its ring, per §3.
2. Where a node's true hierarchy depth doesn't align with a populated ring (e.g. Option B's ToR occupying the "Tier-2" slot), remap per the collapse table in §3.3. This remapping is a **static per-option lookup**, not a dynamic layout decision.

### 5.2 Angular position and arc width within a ring

For each ring, independently:
1. Compute `weight` per node. Default weight = **deduplicated downstream server count** (a rack served by two leaves counts its servers once, not twice, when computing the leaf arcs' widths). Alternative weight modes (bandwidth-sum, raw device count) are configurable per §9.2.
2. Order nodes within the ring to **minimize link crossings** to the adjacent (parent) ring — this is the radial analogue of the classic Sugiyama crossing-minimization step (barycenter or median heuristic, applied per ring pass, working inward from the outermost populated ring, R6/Server, toward R0/Region, then refined in a second pass back outward toward R6).
3. Assign angular span proportional to weight, with a fixed minimum arc width so that low-weight nodes remain clickable/hoverable.
4. Leave a small fixed angular gutter between sibling arcs and a larger gutter between groups that share a common parent, to visually pre-group children before links are even drawn (reduces reliance on the links alone for grouping legibility).
5. **Rack↔leaf alignment (resolved, see §10 item 2):** at R4, data-leaf and management-leaf arcs are angularly positioned to align with the R5 rack arc(s) they serve, rather than clustering all leaves of one plane into a single angular block. This keeps rack-to-leaf links short and close to radial, minimizing lateral curvature and crossing at the ring pair most viewers will inspect closely (rack-level detail).

### 5.3 Radii

Ring radii are fixed proportions of total chart radius, populated rings only (empty rings contribute no radius, per §3.2). Minimum ring band thickness is set to accommodate label text at the smallest supported chart size; if a ring cannot fit labels at current zoom, labels degrade to hover-only (see §8.4) rather than shrinking arc geometry.

---

## 6. Edge / Link Model

### 6.1 What a link represents

A link is drawn between a node in ring N and a node in ring N±1 wherever a real parent/child (containment or routing-adjacency) relationship exists in the source data. Links are **not** drawn:
- Between nodes in the same ring.
- Between non-adjacent rings (a server never links directly to a spine; it always routes through the intermediate ring's node, even at Option A/B where that ring is collapsed — the collapse itself resolves this, see §3.3).
- Where the reference architecture explicitly forbids the underlying adjacency (see §7.6 — these are rendered, if at all, as a distinct "forbidden" glyph, not a normal link).

### 6.2 Link color (plane encoding)

- **Data fabric links**: one color family (e.g. blue spectrum).
- **Management fabric links**: a second, clearly distinguishable color family (e.g. green spectrum).
- **Physical containment links** (region→pod→rack→server, plane-independent): a neutral color (e.g. grey), always rendered, forming the "skeleton" that data/mgmt links overlay.
- **OOB links** (§7.1): a third distinct family (e.g. amber), sparse by design.

### 6.3 Link weight / stroke width

Stroke width scales with a configurable metric — default is **1** (uniform) so that link *density* (via bundling, §6.4) is the primary signal of path multiplicity, rather than double-encoding it in stroke width. Bandwidth-weighted stroke is available as an alternate mode (§9.2) for network-engineering-focused views.

### 6.4 Hierarchical edge bundling

Given the density risk identified for Option C/D leaf-spine ECMP meshes and dual-plane overlay:

1. Links are grouped by shared endpoints' common ancestry — e.g., all links from a given pod's data-leaf set to that pod's data-spine set are candidates for bundling together.
2. Each bundle follows a smooth path (e.g. B-spline through control points derived from the midpoint region between the two rings) that carries the visual "trunk," splitting into individual fine strands only in the final approach to each endpoint arc.
3. Bundling strength is a tunable parameter (0 = fully separate curves, 1 = maximally bundled trunk-and-branch). Default: **0.7**, chosen to keep individual link traceability on hover (§8.3) while controlling visual clutter at rest.
4. Bundling is computed **per plane, independently** — data-plane bundles and management-plane bundles never merge into a shared trunk, even where their endpoint arcs are adjacent, since merging would visually imply a shared-fabric relationship the architecture explicitly denies.

### 6.5 Multi-parent rendering (dual-leaf racks, ECMP)

No special-case geometry is required beyond the base model: a rack node with two leaf parents simply has two incoming link bundles from R4; this is the natural consequence of decoupling position from parentage (§1.3) and requires no additional rule.

---

## 7. Categorization Layer (Out-of-Ring-Geometry Structures)

These five structures (§2, items 4–8) are represented as **attributes on existing nodes/links**, not as new rings or independent link sets, per the decision to keep them for a later phase. This section specifies placeholder encoding so the schema doesn't need to be revisited when they're built out.

### 7.1 OOB / break-glass hierarchy
Rendered as a sparse, independent link set (own color, §6.2) touching only console-port-bearing nodes. Because it is deliberately minimal-shared-infrastructure, it should visually read as barely present against the data/mgmt density — this is intentional and should not be "fixed" by increasing its visual weight.

### 7.2 Trust / administrative domain
Rendered as arc **fill pattern or border style** on R5/R6 nodes (e.g. solid border = operator-controlled, dashed border = tenant-controlled bare-metal, hatched fill = workload endpoint). Never rendered as a link, since the doc frames this hierarchy's effect as primarily *negative* (who may not connect) — see §7.6.

### 7.3 Failure-domain hierarchy
Rendered as a node-level severity indicator (e.g. a small badge or outer-ring tick) on R5 distinguishing single-leaf-rack (failure domain = rack) from dual-leaf-rack (failure domain = leaf), so the viewer can read blast radius without a separate ring.

### 7.4 BGP / routing-policy aggregation domain
Rendered as a subtle background wedge or radial guide line at rack/pod boundaries where prefix aggregation occurs, toggleable, off by default (low priority relative to the primary data/mgmt story).

### 7.5 Border leaf / external connectivity
Rendered as a **satellite glyph** breaking radially inward from the pod arc at R1, past the inner edge of R0/Region (or past the chart center, if R0 is not populated for the current option) — i.e. breaking through the core of the diagram rather than through the tier/rack/server stack it sits alongside. This keeps the glyph representing "exits the fabric toward WAN/DCI/internet" visually distinct from the tiered rings, consistent with its lateral, non-tiered role identified earlier, and avoids routing it through several unrelated rings to reach an edge. DPUs, similarly, render as a small badge on the server arc rather than a separate arc.

### 7.6 Forbidden adjacencies
Where useful for teaching/documentation views, a forbidden adjacency (e.g. workload endpoint attempting fabric peering) can be rendered as a distinct dashed/red "null link" glyph on hover or in an explicit "show constraints" mode — off by default, since constantly rendering absence adds clutter without aiding the primary reading.

---

## 8. Interaction Model

### 8.1 Option / scale selection
A primary control (slider or discrete selector, A–D) switches the active per-option ring population and collapse rules (§3.3). Transition between options should animate ring insertion/removal and arc re-proportioning rather than hard-cutting, so the viewer retains context of what changed.

### 8.2 Plane toggle
Independent show/hide toggles for **Data**, **Management**, and **OOB** link sets (§6.2), each togglable without affecting ring/node geometry — only link visibility changes. Default state: Data + Management on, OOB off, forbidden-adjacency glyphs off.

### 8.3 Hover / focus behavior
Hovering a node highlights: (a) all directly connected links in the currently-visible planes, (b) the bundle trunk(s) those links belong to, de-bundling them visually to full individual-strand resolution for the duration of the hover, and (c) dims unrelated arcs/links to reduce competing signal.

### 8.4 Label degradation
At small arc widths (per §5.3), labels move from always-on to hover/click-triggered tooltip, so the ring geometry stays legible at Option D scale without text collision.

### 8.5 Drill / filter
Clicking a pod or rack arc can optionally filter the visualization to that subtree (all rings recompute weights/angles relative to the selected node's descendants only) — useful for inspecting a single rack's dual-plane, dual-leaf structure in isolation at Option C/D scale, where the full-pod view is necessarily dense.

---

## 9. Data Schema Summary

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

Note the two links into `rack-14` from `leaf-data-14a` and `leaf-data-14b` — this is the dual-leaf case rendered natively, with no schema-level special case required.

### 9.2 Configuration parameters (implementation-facing, not per-instance data)

| Parameter | Default | Purpose |
|---|---|---|
| `weight_mode` | `deduplicated_server_count` | Arc sizing metric (§5.2) |
| `bundle_strength` | `0.7` | Edge bundling tightness (§6.4) |
| `stroke_mode` | `uniform` | Alternate: `bandwidth_weighted` |
| `min_arc_width_px` | implementation-defined | Floor for tiny-weight nodes (§5.2) |
| `label_collision_threshold_px` | implementation-defined | Trigger for §8.4 degradation |

---

## 10. Open Questions — Status

1. **Crossing-minimization convergence** across five to seven simultaneously-optimized rings. **Deferred.** Not required for the first demo; a simpler single-pass barycenter heuristic (§5.2) is acceptable as a placeholder. Revisit once a working prototype exposes whether local-optimum crossings are actually visually disruptive in practice, rather than optimizing pre-emptively.

2. **Weight mode interaction with dual-plane overlay** (data-plane vs. management-plane leaf arcs at R4). **Resolved: interleave by rack alignment.** Data-leaf and management-leaf arcs are positioned so each aligns angularly with the rack(s) it serves at R5, rather than being grouped as two separate angular blocks. This shortens and simplifies the rack↔leaf link geometry (near-radial, minimal lateral curvature) at the cost of not clustering all-data-leaves together as a single visual block — an acceptable tradeoff since link legibility to the adjacent ring matters more here than intra-ring grouping by plane.

3. **Border leaf satellite glyph collision at high pod count** (Option D). **Tentative direction: extend to a third dimension.** Rather than stacking colliding satellite glyphs in 2D, the radial topology itself would be depth-stacked — each pod's full ring stack (R2–R6, or whichever subset is populated) rendered as its own radial "disc," with multiple pod-discs arranged along a z-axis. Region (R0) would then plausibly act as a shared spine/axis running through all pod-discs rather than being duplicated per disc. This resolves the R1/Pod-ring crowding problem structurally rather than through glyph-collision avoidance, but introduces new open questions of its own (navigation/rotation model, occlusion between discs, whether bundled edges should be allowed to run *between* discs for cross-pod links). **Status: exploratory, not specified further until after the 2D demo.**

4. **Whether Option A's single-switch case is worth a ring-based rendering at all**, versus a simplified fallback view. **Still open**, no direction chosen yet. Candidate approaches to evaluate later: (a) render it through the same ring model with R1–R4 simply empty, accepting a mostly-empty center; (b) a distinct simplified non-radial fallback card for Option A only. Deferred until the other three options are validated in the prototype, since Option A's near-triviality makes it low-risk to leave unresolved.

**Demo sequencing implication:** items 1 and 4 require no further design work before building the first prototype. Item 2 is resolved and should be implemented in the first prototype pass. Item 3 is explicitly out of scope for the first (2D) demo and should not block it.

---

*End of specification.*
