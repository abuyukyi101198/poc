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

The datacenter topology contains eleven coexisting structures. This specification's ring/link model covers the first
three, which are genuine (near-)hierarchies. The remaining eight are categorizations represented through node/link
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
10. **MAAS control-plane / provisioning hierarchy** (region controller → rack controller(s) → enlisted machine/BMC).
    This does **not** collapse onto physical containment (item 1) — a `rackd` rack controller does not have to map
    1:1 to a physical rack (Option A/B may run one controller for a whole site; Option C/D racks are typically served
    by ≥2 redundant rack controllers). See §7.7.
11. **Availability Zone (AZ) / multitenancy boundary** — targets **R5 Rack and R6 Server only** (a whole rack's
    tenancy assignment, with an optional per-server override for mixed-tenancy racks). Deliberately does **not**
    touch R1 Pod, keeping the rendering a direct rack-arc wedge fill rather than a sub-arc partition problem. See §7.8.

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
| R5 Rack   | A rack (logical + physical unit). Note: this is a *physical* containment unit — it is a distinct concept from the MAAS control-plane's rack-controller grouping, which does not always map 1:1 (§7.7). Its arc fill is overridden by `availability_zone` when set (§7.8) | One arc per rack                                                                        |
| R6 Server | A server, including GPU/accelerator nodes                  | One arc per physical server; DPUs are a server attribute, not a separate arc; carries an AZ override stroke only when its own `availability_zone` differs from its parent rack's (§7.8) |

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
  rack_controller_ids: string[],                           // R1/R5 only, §7.7; [] for all other rings
  availability_zone: string | "n/a",                       // R5/R6 only, §7.8; "n/a" for all other rings
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

Structures 4 through 11 from §2 (excluding structure 9's peer link, which is the one attributed exception that *is* a
link, specified in §6.1a) are represented as **attributes on existing nodes**, not as new rings or independent link
sets. This section specifies their encoding.

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

### 7.7 MAAS control-plane / provisioning hierarchy

Represented via `rack_controller_ids` (§4.2) on R1 Pod and R5 Rack nodes — a list because a rack is typically served
by **two or more redundant rack controllers** in Options C/D, while in Options A/B a single controller may cover an
entire site (populated at R1 instead of per-rack). This is deliberately **not** folded into the R5 Rack node's
identity or the physical containment tree (§2 item 1) precisely because the mapping isn't 1:1 — a rack controller
grouping is a control-plane concept, a rack is a physical one, and conflating them was an error in earlier fixture
comments this spec revision corrects. Rendered **exclusively via the tooltip's dedicated MAAS Control Plane
section** (§8.6) listing the controller IDs — no arc-level badge, glyph, or other on-canvas indicator is drawn; the
rack/pod arc itself carries no visual sign of controller assignment until hovered. Never rendered as a link, and
never affects ring geometry.

### 7.8 Availability Zone (AZ) / multitenancy boundary

Represented via `availability_zone` (§4.2) on **R5 Rack and R6 Server nodes only** — deliberately excluding R1 Pod, so
that AZ assignment is always a whole-arc property of an existing node rather than a sub-arc partition problem. This
resolves cleanly because AZ boundaries at rack granularity never need to split a single arc into pieces:

- **R5 Rack (primary case):** `availability_zone` directly overrides the rack arc's **fill color**, replacing the
  flat neutral rack fill from §11.3 with a colour drawn from a small qualitative accent palette, distinct from the
  Data/Management/Border hues already in use elsewhere (§6.2, §11.3) so AZ never gets confused with plane identity.
  The palette is deliberately **subdued/dimmed** rather than fully saturated — a rack's AZ assignment is a
  background categorization signal, not an active-routing signal like the §6.2 link colours, so it should read
  visually quieter than Data/Management tints on the same dark canvas while remaining distinguishable at a glance:
  `#1F5C34` (dim Green), `#1E4E78` (dim Blue), `#7A2733` (dim Red), `#8C6A24` (dim Amber). AZ→colour assignment
  is deterministic (e.g. a stable hash of the AZ id modulo palette length) so the same AZ id always renders the same
  colour across sessions and across re-renders.
- **R6 Server (override case only):** rendered only when a server's own `availability_zone` differs from its parent
  rack's — e.g. a mixed-tenancy rack, or a server temporarily reassigned. Drawn as a thin outer-edge stroke in the
  overriding AZ's colour (from the same palette), **not** a full arc fill, since R6's fill is otherwise reserved for
  the neutral containment gradient (§11.3) and a full-fill override there would visually compete with the rack-level
  signal one ring further in.
- No link is ever drawn for AZ membership, and no ring geometry changes — same rationale as §7.7.

If a deployment has more distinct AZ ids than the accent palette has entries, see §10 (AZ palette exhaustion) for the
deferred fallback strategy — not yet solved by this revision.

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

### 8.6 Tooltip panel (hover detail)

Replaces the plain browser-native tooltip with a structured, styled panel, fired from the same `mouseenter` event as
the lineage hover (§8.3) — both effects run together, the panel does not steal or delay the lineage highlight.
Content is assembled per-node from whichever attributes are actually populated; empty/`n/a` sections are omitted
entirely rather than shown blank, so a plain spine switch's panel is much shorter than a rack's.

**Layout, top to bottom (hairline divider between each present section):**

1. **Header row** — a small square swatch of the node's own arc fill (§11.3, §7.8) + the node `label` in bold
   primary text, with an inline ring/plane badge (e.g. "R5 · Rack", "R4 · Data Leaf").
2. **Meta row** — `weight` and arc span in degrees, secondary/muted text, single line, de-emphasized.
3. **MAAS Control Plane section** (§7.7) — rendered only if `rack_controller_ids.length > 0`. Small-caps section
   label "MAAS CONTROL PLANE" with a 2px left border in Ubuntu Orange (an accent tie to "control," distinct from the
   Data-plane hue it shares the palette with — see styling below), body lists controller IDs
   (e.g. `rc-03, rc-07`) in monospace.
4. **Availability Zone section** (§7.8) — rendered only if `availability_zone !== "n/a"`. Small-caps section label
   "AVAILABILITY ZONE" with a 2px left border in that AZ's own assigned accent colour (§7.8's qualitative palette),
   body shows the AZ id next to a matching colour swatch. On an R6 override row (server AZ ≠ parent rack AZ), the
   section additionally states the parent rack's AZ for contrast, e.g. "az-blue (rack: az-green)".
5. **Categorization footer** — `trust_tier` and `failure_domain_role` as small inline text badges (reusing the
   border-style/severity encoding already defined in §7.2/§7.3 as a colour/pattern swatch, not new iconography) —
   this is a textual restatement of what's already visible on the arc itself, included for accessibility/screen
   reader parity rather than as new information.
6. **Metadata** — any free-form `metadata.description` text, italic, muted, always last.

**Styling (dark theme, §11.1/§11.2):**

| Property | Value |
|---|---|
| Panel background | `#1E1E1E` (chart panel surface, §11.1) |
| Panel border | `1px solid rgba(247, 247, 247, 0.12)`, 4px corner radius |
| Panel shadow | A subtle drop shadow is permitted here (unlike chart geometry, §6.3's flat-fill rule applies only to the SVG chart surface, not floating UI chrome) |
| Padding | `10px 12px`; max-width `260px` |
| Body font | Ubuntu, 11px, primary text `#F7F7F7` |
| Header font | Ubuntu, 12px, semibold, primary text `#F7F7F7` |
| Monospace fields | Ubuntu Mono, for rack controller IDs and any rack/server label, consistent with §11.2's R5/R6 arc-label treatment |
| Section label | Ubuntu, 9px, small-caps, `letter-spacing: 0.05em`, secondary/muted text `#9C948C`, 2px accent left-border per section (Orange for Control Plane, AZ colour for Availability Zone) |
| Divider | `1px solid rgba(247, 247, 247, 0.08)` hairline between sections |

**Positioning:** anchored 12px offset from the cursor, following pointer movement while hovering; flips to the
opposite side of the cursor when it would overflow the SVG viewport edge, so the panel never clips off-screen.

**Dismissal:** on `mouseleave`, matching §8.3's resting-state restoration — no separate close affordance needed since
this is a hover panel, not a pinned/click-to-open one.

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
      "rack_controller_ids": ["rc-03", "rc-07"],
      "availability_zone": "az-blue",
      "metadata": {}
    },
    {
      "id": "server-14-06",
      "ring": "R6",
      "label": "R14-Srv06",
      "weight": 1,
      "plane": "shared",
      "leaf_role": "n/a",
      "trust_tier": "tenant",
      "failure_domain_role": "n/a",
      "rack_controller_ids": [],
      "availability_zone": "az-green",
      "metadata": { "rack": "rack-14", "note": "AZ override — reassigned out of the rack's default az-blue." }
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
      "rack_controller_ids": [],
      "availability_zone": "n/a",
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
      "rack_controller_ids": [],
      "availability_zone": "n/a",
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
Option B, rendered with the standard dendrogram path grammar (§6.4) and a distinct plane color (§6.2). `rack-14`
demonstrates the MAAS control-plane attribute (§7.7 — two redundant rack controllers) and the primary Availability
Zone case (§7.8 — rack arc fill overridden to `az-blue`'s accent colour); `server-14-06` demonstrates the R6 AZ
override case (§7.8) — its own `availability_zone` (`az-green`) differs from its parent rack's (`az-blue`), which is
what triggers the thin outer-edge override stroke rather than a full-fill change.

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

4. **Cloud-management cluster membership — descoped, may return.** An earlier draft of this spec proposed a
   `cluster_membership` attribute (Ceph replica sets, LXD clusters, MicroOVN control-plane, Kubernetes node groups)
   plus a cross-cluster highlighting interaction mode. Both are descoped from the current revision pending clearer
   requirements — reintroducing it later would need its own same-tier "highlight by shared attribute" selection
   model distinct from the ancestor-lineage hover in §8.3, since cluster membership is a set relationship, not a
   parent/child one.

5. **AZ palette exhaustion (§7.8).** The Availability Zone accent palette is a small fixed qualitative set (4 colours
   in this revision). A deployment with more distinct AZ ids than palette entries needs a fallback — candidates
   include reusing colours with a distinguishing pattern/hatch, or falling back to tooltip-only disambiguation
   (§8.6) beyond the palette's capacity — deferred pending a fixture with more than 4 AZs.

6. **MAAS "Fabric" naming collision (§7.7).** MAAS's own data model uses "Fabric" to mean a group of associated
   VLANs — unrelated to this spec's pervasive use of "physical fabric" for the Clos data/management networks. If a
   future revision represents MAAS Fabric/VLAN/Subnet objects directly (beyond the rack-controller grouping already
   in §7.7), it must use different terminology in this document to avoid conflating the two concepts.

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

- **Border leaf as R4 ring member (§4.3, §7.5):** implemented. `border-leaf-1`/`border-leaf-2` are ordinary
  `ring: "R4"` nodes with `leaf_role: "border"` and full-mesh spine-adjacency links, matching other R4 leaves.
- **ToR peer link (§6.1a):** not applicable to the Option C fixture (Option B only); no fixture exists yet for
  Option B. The rendering path (`radialLinkPath`'s same-ring/virtual-gap branch) is implemented and ready for a
  future Option B fixture.
- **Plane-tinted fills and dark theme (§11.1, §11.3):** implemented — dark canvas/panel/text surfaces, plane-tinted
  R3/R4 fills, and the dedicated Border Leaf Sage fill are all live in `layout.js`/`render.js`/`style.css`.
- **Parallel lane offset (§6.6):** implemented — Data/Management/Containment/Peer-adjacency lanes are offset by a
  fixed px amount from each gap's midpoint radius (`LANE_OFFSET_PX` in `render.js`).
- **Label degradation (§8.4):** implemented at the arc-label level (`MIN_LABEL_DEG` in `render.js` hides inline
  labels below a per-ring angular threshold); full hover/click-triggered re-reveal beyond the tooltip panel is not
  separately implemented, since the tooltip panel (§8.6) already serves that purpose on hover.
- **Tooltip panel (§8.6):** implemented, including the R5/R6 monospace title treatment and the categorization
  footer's colour/pattern swatches (solid/dashed/hatched trust-tier swatch, spof/redundant failure-domain dot) —
  both were gaps in an earlier pass and have since been closed in `tooltip.js`/`style.css`.
- **MAAS control-plane rendering (§7.7):** the rack-controller badge previously drawn on the R1/R5 arc has been
  **removed**. Controller assignment is now surfaced exclusively through the tooltip's "MAAS Control Plane" section
  (§8.6) — there is no on-canvas indicator of `rack_controller_ids` until a node is hovered.
- **Availability Zone palette (§7.8):** the AZ accent palette has been dimmed from the original fully-saturated
  candidate set to a subdued/muted set (`#1F5C34`/`#1E4E78`/`#7A2733`/`#8C6A24`), so AZ fill overrides read as a
  quieter background signal against the dark canvas rather than competing visually with Data/Management link colours.

