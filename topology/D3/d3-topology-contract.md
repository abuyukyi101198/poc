# D3 Topology Data Contract

## Scope and source of truth

This document describes the data consumed by the current D3 demo in
`topology/D3`, as implemented on 2026-08-13. Runtime behavior in `index.html`
and `js/*.js` takes precedence over the broader design specification.

The Disc View and Stack View share the same node objects, but Stack View adds
conditional requirements for pod ownership and CIDR metadata.

## Loading boundary

The demo does **not** currently call `d3.json()`, `fetch()`, or `forceLink()`.
`index.html` dynamically imports one JavaScript fixture module and expects
named exports:

```js
export const nodes = [/* Node */];
export const links = [/* Link */];
export const meta = {/* Meta */}; // optional
```

The semantic graph shape is therefore:

```text
Graph
  nodes: Node[]  required
  links: Link[]  required
  meta: Meta     optional, defaults to {}
```

A plain JSON object with the same three properties is a suitable adapter
output, but it is **not directly loadable by the current page** without either
a JavaScript wrapper module or a loader change. `fixtureMeta` exports present
in the demo fixtures are not read by the application.

## Concise schema

```text
Node
  id: string                         required, non-empty, globally unique
  ring: Ring                         required
  label: string                      required
  weight: number                     required, finite and > 0
  plane: NodePlane                   required
  leaf_role: LeafRole                optional, default "n/a"
  trust_tier: TrustTier              optional, default "n/a"
  failure_domain_role: FailureRole   optional, default "n/a"
  rack_controller_ids: string[]      optional, default []
  availability_zone: string          optional, default "n/a"
  metadata: object                   optional, default {}

Link
  source: string                     required, references Node.id
  target: string                     required, references Node.id
  plane: LinkPlane                   required
  type: LinkType                     required
  weight: number                     optional, conventionally 1; not rendered

Meta
  option: string                     optional
  label: string                      optional
  subtitle: string                   optional
  ringNames: Record<Ring, string>    optional
```

For full parity with the checked-in fixtures and design specification, emit
all Node top-level fields. Use the documented sentinel/default values rather
than `null`. The renderer tolerates omission of the fields marked optional,
but omitting them removes tooltip, classification, or grouping behavior.

## Enumerations

| Type | Accepted values | Notes |
|---|---|---|
| `Ring` | `R0`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6` | Canonical inner-to-outer order. See the `R0` caveat below. |
| `NodePlane` | `data`, `mgmt`, `shared`, `n/a` | Routing nodes normally use `data`/`mgmt`; containment nodes normally use `shared`. |
| `LinkPlane` | `data`, `mgmt`, `shared` | Drives link color and toggle grouping. |
| `LeafRole` | `access`, `border`, `n/a` | `border` has special R4 coloring; non-leaf nodes use `n/a`. |
| `TrustTier` | `operator`, `tenant`, `workload`, `n/a` | Tooltip CSS only recognizes the first three classifications. |
| `FailureRole` | `spof`, `redundant`, `n/a` | Tooltip CSS only recognizes `spof` and `redundant`. |
| `LinkType` | `routing_adjacency`, `containment`, `peer_adjacency` | `peer_adjacency` is toggled and colored independently. |

Canonical ring meanings are:

| Ring | Meaning in current model |
|---|---|
| `R0` | Region; layout-declared but unused by current fixtures |
| `R1` | Pod/root |
| `R2` | Superspine |
| `R3` | Spine |
| `R4` | Leaf, border leaf, or TOR in Options A/B |
| `R5` | Rack |
| `R6` | Server |

There is no independent `node.type` field. The visualization derives node
type from `ring`, `plane`, and `leaf_role`. `metadata.role` is retained by the
fixtures but is not consulted by the current renderer.

## Node fields

| Field | Type | Required | Runtime use and constraints |
|---|---|---:|---|
| `id` | string | Yes | Identity, joins, DOM attributes, filtering, lineage traversal, and deterministic ordering. Must be globally unique and should not contain the internal link-key delimiter `→`. |
| `ring` | `Ring` | Yes | Selects the radial band, ordering depth, colors, labels, font sizing, and Stack View layer. Unknown values cause the node to be omitted by radial layout. |
| `label` | string | Yes | Arc/box label and tooltip title. There is no fallback to `id` in Disc View. |
| `weight` | number | Yes | Proportional arc width, centroid weighting, Stack View box width/height, and pod server count. Must be a finite positive number; string, zero, negative, `NaN`, and infinite values can produce invalid geometry. |
| `plane` | `NodePlane` | Yes | R2-R4 tint, data-before-management tie-breaking, Stack View arm, tooltip type label, and generated CSS class. |
| `leaf_role` | `LeafRole` | No | R4 `border` nodes receive border-leaf fill and are counted separately in Stack View. Missing values generate the fallback class `leaf-role-n-a`. |
| `trust_tier` | `TrustTier` | No | Optional tooltip classification. Missing/`n/a` is omitted. |
| `failure_domain_role` | `FailureRole` | No | Optional tooltip classification. Missing/`n/a` is omitted. |
| `rack_controller_ids` | string[] | No | Optional MAAS tooltip section. Missing/empty array is omitted. Elements are display strings. |
| `availability_zone` | string | No | Any non-empty value except `n/a` is deterministically hashed into one of four colors. Colors R5 racks, groups Stack View racks, and can override an R6 server stroke. |
| `metadata` | object | No | Free-form extension object. Runtime-recognized properties are listed below. |

### Runtime-recognized metadata

| Property | Type | Applies to | Required | Use |
|---|---|---|---:|---|
| `metadata.rack` | string | R6 server | Conditional | References an R5 node for rack-vs-server AZ comparison. Strongly recommended for every R6 node. |
| `metadata.pod` | string | Multi-pod R3-R6 nodes | Conditional | References an R1 pod. Required for Stack View bucketing and pod drill filtering. R2 superspines are shared and intentionally omit it. |
| `metadata.cidr` | string | Multi-pod R1 node | Conditional | Required for inclusion and ordering in Stack View. Must be valid IPv4 CIDR (`a.b.c.d/0..32`). |
| `metadata.description` | string | Any | No | Tooltip description; takes precedence over `note`. |
| `metadata.note` | string | Any | No | Tooltip description fallback. |

Other fixture metadata such as `role`, `serves_racks`, `leaf_count`,
`data_leaves`, `mgmt_leaves`, `node_type`, and `accelerators` is passed through
but not read by the current application.

## Link fields and endpoint representation

| Field | Type | Required | Runtime use and constraints |
|---|---|---:|---|
| `source` | string | Yes | A `Node.id`, never an array index or embedded node object. |
| `target` | string | Yes | A `Node.id`, never an array index or embedded node object. |
| `plane` | `LinkPlane` | Yes | Link color, CSS class, statistics, and toggle group. |
| `type` | `LinkType` | Yes | CSS class and peer-adjacency detection/color/toggle behavior. |
| `weight` | number | No | Present as `1` in fixtures but ignored by current layout and renderer. |

Links have no input `label` field. Their native SVG tooltip is generated as
`source → target`, followed by `plane` and `type`.

### Direction and topology rules

- Non-peer links must be directed from the inner/parent node in `source` to
  the outer/child node in `target`. Rendering can draw reversed radii, but
  layout child indexes and R6 primary-parent selection rely on this direction.
- `routing_adjacency` normally connects adjacent **populated** routing layers,
  including leaf/TOR-to-rack.
- `containment` normally connects R5 rack to R6 server.
- R1 pod-to-R5 rack `containment` links are allowed by current fixtures but
  deliberately excluded from Disc View drawing and lineage traversal.
- `peer_adjacency` is the supported same-ring exception (currently R4 TOR to
  R4 TOR) and conventionally uses `plane: "shared"`.
- Every endpoint must resolve to exactly one node. The renderer silently
  suppresses unresolved links rather than reporting an error; conforming
  producers must reject or resolve them before output.
- Self-links are not part of the model.
- Multiple parents are supported. For R6 grouping, the first input-ordered
  parent link from the immediately inner populated ring becomes the visual
  clustering anchor; all resolvable links are still drawn.
- Ordered endpoint pairs should be unique. D3 joins and lineage indexes key a
  link only as `source→target`, ignoring `plane`, `type`, and `weight`.
  Parallel links with the same ordered endpoints therefore overlap and do not
  have independent interaction identity.

## Meta fields

| Field | Type | Required | Use/fallback |
|---|---|---:|---|
| `option` | string | No | Center label, title fallback, and a hard-coded Border Leaf legend assumption (`A`/`B` versus other options). |
| `label` | string | No | Browser title and SVG accessible label; falls back to `Option ${option}`. |
| `subtitle` | string | No | Page subtitle; falls back to `Option ${option}`. |
| `ringNames` | object | No | Maps ring IDs to display labels in ring labels, legend, and tooltip. Missing keys use built-in names. |

`meta.title` is present in fixtures but unused. Stack View activation is tied
to the page's hard-coded Option D branch, not to a metadata flag.

## Grouping, coloring, sizing, and tooltip behavior

### Grouping and ordering

- Disc View groups by `ring` in canonical R0-R6 order.
- The ring immediately inside R6 is positioned first in fixture node order.
- R6 nodes are grouped by the first directed parent link from that inner ring;
  unparented servers are retained in an `__ungrouped__` bucket.
- Remaining inner rings are ordered by the weighted centroid of outward
  children. Input node/link order can therefore affect deterministic layout.
- Stack View ignores link geometry. It groups R3-R5 nodes by `metadata.pod`,
  separates R3/R4 by `plane`, treats R2 as shared across all pods, and omits
  R6 boxes from the overview.

### Color and size

- `weight` controls node arc span and Stack View subdivision.
- R2-R4 use `plane` tints; R4 `leaf_role: "border"` overrides the tint.
- R5 uses `availability_zone` when populated, otherwise the neutral rack fill.
- R6 uses a neutral fill. A server with an explicit AZ different from the AZ
  of `metadata.rack` receives an AZ-colored separator stroke.
- Link color comes from `plane`, except `type: "peer_adjacency"`, which uses a
  dedicated peer color and toggle lane.

### Tooltips

Node tooltips read:

- `label`, `ring`, `plane`, and `weight`;
- `rack_controller_ids`;
- `availability_zone` and `metadata.rack`;
- `trust_tier` and `failure_domain_role`;
- `metadata.description` or `metadata.note`.

Stack View's column tooltip additionally uses the pod's `label`, `weight`, and
`metadata.cidr`, then derives counts from child `ring`, `plane`, `leaf_role`,
`availability_zone`, and `metadata.pod` values.

## Filters, events, and generated CSS/DOM attributes

- Pod filtering keeps all R2 nodes, the selected R1 node, and nodes whose
  `metadata.pod` equals the selected pod ID. It keeps a link only if both
  string endpoints survive.
- Option D auto-selects the first R1 pod after lexicographically sorting valid
  `metadata.cidr` strings; Stack View separately orders columns by parsed IPv4
  start address.
- Hover lineage traverses links toward lower ring depth and supports multiple
  parents. Same-ring peer links do not become ancestors.
- Plane buttons toggle links by generated `data-plane`. Peer links use
  `peer_adjacency`; all other links use their `plane` value.
- The peer button is shown only when at least one input link has
  `type: "peer_adjacency"`.
- Generated node classes are
  `node-arc ring-${ring} plane-${plane} leaf-role-${leaf_role}`.
- Generated link classes are `link plane-${plane} type-${type}`.
- Tooltip classes interpolate `trust_tier` and `failure_domain_role`; strict
  enum validation is required rather than accepting arbitrary strings.
- CSS currently applies generic behavior to `.node-arc`, `.link`, and
  `.stack-box`, monospace labels to `.arc-label.ring-R5/R6`, explicit legend
  colors for known `data-ring` values, and explicit swatches for the documented
  trust/failure enums. Generated plane/type/role classes remain extension
  hooks even where no specific CSS selector exists today.

## Input mutation

The rendering pipeline does not mutate caller-owned node or link objects:

- radial layout creates new node objects with `startAngle`, `endAngle`,
  `innerRadius`, and `outerRadius`;
- Stack View creates new box objects;
- filtering creates new arrays when a pod is selected;
- links retain string endpoints because no D3 force simulation resolves them
  into embedded objects.

The returned/resolved link array and link objects are the original references,
but the current renderer only reads them. `option-d.js` itself enriches its
private fixture nodes with `metadata.pod`/`metadata.cidr` before export; that is
fixture construction, not renderer mutation.

## Referential and validation constraints

A conforming adapter or validator must enforce all of the following before
the graph reaches the browser:

1. `nodes` and `links` are arrays; every element is an object.
2. Node IDs are non-empty strings, globally unique, and do not contain `→`.
3. Every node has a supported ring, non-empty label, supported plane, and
   finite positive numeric weight.
4. Optional classification fields use only documented enums and defaults.
5. `rack_controller_ids` is an array of strings; `metadata` is an object.
6. Every link has string endpoints resolving to unique node IDs.
7. Link plane/type values are supported and coherent with the relationship.
8. Parent-child links use parent-to-child direction; peer links use the same
   ring; self-links are rejected.
9. Duplicate ordered endpoint pairs are rejected or deliberately aggregated.
10. Every R6 server has a directed parent from the immediately inner populated
    ring and, when supplied, `metadata.rack` resolves to an R5 node.
11. For Stack View, every R1 pod has valid IPv4 CIDR metadata and every
    pod-owned non-R2 node has a resolvable `metadata.pod`.

## Known implementation caveats

- Layout declares R0, but hover lineage's depth table starts at R1. R0 can be
  laid out but is not fully supported by current ancestor traversal. Avoid R0
  until interaction depth handling is updated.
- Unknown-ring nodes are silently omitted; unresolved links and R1-R5
  containment links are silently not drawn.
- The layout does not validate values or enforce a minimum arc width.
- `parseCidr()` performs no input validation. Invalid IPv4/CIDR values may
  produce misleading ordering or geometry instead of a useful error.
- Border Leaf legend visibility is inferred from `meta.option`, not from the
  actual presence of `leaf_role: "border"` nodes.
- Stack View's `links` argument is currently unused; its hierarchy depends on
  `metadata.pod` and node classifications.

## Runtime references

- Fixture loading and pod filtering: `index.html:198-242`, `index.html:419-445`
- Disc render data flow and metadata: `index.html:365-395`
- Node rendering and generated classes: `js/render.js:98-123`, `js/render.js:136-218`
- Link resolution, classes, labels, and silent filtering: `js/render.js:341-377`
- Ring model, weights, ordering, and layout cloning: `js/layout.js:49-64`, `js/layout.js:147-253`, `js/layout.js:323-371`
- Hover lineage and toggle behavior: `js/interaction.js:34-56`, `js/interaction.js:80-239`
- Tooltip fields and defaults: `js/tooltip.js:95-226`
- Stack View conditional contract: `js/stackview.js:121-173`, `js/stackview.js:230-344`
- IPv4 CIDR parser: `js/ip.js:10-25`
- CSS selectors and supported classification classes: `css/style.css:610-633`, `css/style.css:681-703`, `css/style.css:745-763`, `css/style.css:902-948`
