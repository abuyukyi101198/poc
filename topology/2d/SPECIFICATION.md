# Data Center Network Topology Explorer — Final Specification (Reconciled with demo.html)

A deterministic, non-force-directed radial visualization of a MAAS data center network. Built with D3 v7 as a single self-contained HTML file. Every position is computed from fixed polar formulas; the same input always produces pixel-identical output.

---

## Goal

Map the physical cable-level connectivity of a MAAS-managed data center as a radial hierarchy — from the central region controller outward through rack controllers (rackd), switches, and servers. Ports are the atomic visual unit: every small square glyph is a real port, and every line between two squares is a real cable. The visualization lets an operator answer questions like:

- Which rack controller serves this server, and through which switches?
- Where are the redundant uplinks?
- Which racks lack management plane connectivity?

---

## Tech constraints

- D3 v7 from CDN: `https://d3js.org/d3.v7.min.js`
- Single `index.html` with inline `<style>` and `<script>`
- SVG `viewBox="0 0 W H"` where `W = window.innerWidth`, `H = window.innerHeight`, `width: 100%`, `height: 100%`
- No frameworks, no `d3.forceSimulation`
- **Determinism is a hard requirement** — no `Math.random()` anywhere in layout or data generation

---

## Coordinate system

All angles in radians, 0 = 12 o'clock, clockwise positive (matching `d3.pie()` / `d3.arc()` convention):

```js
function polarAbs(angle, r) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}
```

Center: `cx = W / 2`, `cy = H / 2`. All radii use a **scale factor `S`** derived from the viewport and a reference half-dimension of 350:

```js
HALF = Math.min(W, H) / 2;
S    = HALF / 350;   // 1.0 when min(W,H) = 700px
```

Every radius constant is expressed as a multiple of `S` so the diagram fills the viewport at any window size. `PORT_SZ = 5` and `PORT_GAP = 3` are **not** scaled by `S` — they stay at fixed pixel sizes for legibility. All `S`-based constants recompute on every render and on window resize.

---

## Data model

### Top-level structure

```js
{
  regionController: { id, name, ports: [uplinkPort, ...] },
  rackControllers:  [ rackd, ... ],
  racks:            [ rack, ... ]
}
```

### Region controller

```js
{
  id: "region-01",
  name: "Region Controller",
  ports: [
    { id: "region-01-p1", label: "eth0", connectedTo: "rackd-01-up0" },
    // one port per rackd uplink port, in order of creation
  ]
}
```

### Rack controller (rackd)

```js
{
  id: "rackd-01",
  name: "Rack Controller 01",
  racks: ["rack-01"],           // one or two rack IDs
  uplinkPorts: [
    { id: "rackd-01-up0", label: "uplink0", connectedTo: "region-01-p1" },
    // redundant rackds get a second entry here
  ],
  downlinkPorts: [
    { id: "rackd-01-dn0", label: "dn0", connectedTo: "rack-01-sw-data-0-up0", swType: "data" },
    { id: "rackd-01-dn1", label: "dn1", connectedTo: "rack-01-sw-mgmt-0-up0", swType: "mgmt" },
    // one per switch across all served racks; swType is propagated here for color coding
  ]
}
```

### Rack enclosure

```js
{
  id: "rack-01",
  name: "Rack 01",
  rackdId: "rackd-01",   // back-reference, set by generator after rackd grouping
  switches: [ switch, ... ],
  servers:  [ server, ... ]
}
```

### Switch

```js
{
  id: "rack-01-sw-data-0",
  type: "data" | "mgmt",
  typeIndex: 0,              // 0-based index within same-type siblings in this rack
  uplinkPort: { id: "rack-01-sw-data-0-up0", label: "uplink0", connectedTo: "rackd-01-dn0" },
  downlinkPorts: [
    { id: "rack-01-sw-data-0-p1", label: "eth1", connectedTo: "rack-01-srv-01-nic0" },
    // one per server in the rack
  ]
}
```

### Server

```js
{
  id: "rack-01-srv-01",
  name: "srv-01",
  ports: [
    // dataCnt NIC ports (nic0, nic1, …) — one per data switch in the rack
    { id: "rack-01-srv-01-nic0", label: "eth0", type: "data", connectedTo: "rack-01-sw-data-0-p1" },
    // mgmtCnt BMC ports (bmc0, bmc1, …) — one per mgmt switch in the rack
    { id: "rack-01-srv-01-bmc0", label: "bmc0", type: "mgmt", connectedTo: "rack-01-sw-mgmt-0-p1" }
  ]
}
```

**Port count per server** = `dataCnt + mgmtCnt` for that rack — it is not a fixed 2, it varies with the switch configuration. All `connectedTo` references are **bidirectionally consistent**.

---

## Dummy data generator (deterministic)

### Rackd grouping

```js
function rackdGrouping(rackCount) {
  const groups = [];
  let i = 0;
  while (i < rackCount) {
    if (i % 3 === 1 && i + 1 < rackCount) {
      groups.push([i, i + 1]); // dual-rack rackd
      i += 2;
    } else {
      groups.push([i]);         // solo rackd
      i += 1;
    }
  }
  return groups;
}
```

Pattern: solo, dual, dual, solo, dual, dual, … (every third group is solo).

### Switch count per rack (rack index `i`, 0-based)

```js
const dataCnt = 1 + (i % 3 === 2 ? 1 : 0);   // 2 data switches at racks 2,5,8,…
const mgmtCnt = i % 7 === 6 ? 0               // no mgmt switch at racks 6,13,20,…
              : 1 + (i % 4 === 3 ? 1 : 0);    // 2 mgmt switches at racks 3,7,11,…
```

Switches appended in order: all data switches (index 0…dataCnt-1) then all mgmt switches (index 0…mgmtCnt-1).

### Server count per rack

```js
const serverCount = 4 + ((i * 5) % 8);   // range 4–11, stable across renders
```

### Uplink port count on rackd

- Dual-rack rackds: always 2 uplink ports.
- Solo rackds at `groupIndex % 3 === 0`: 2 uplink ports (redundant).
- Solo rackds otherwise: 1 uplink port.

### Port IDs

Constructed deterministically from parent ID + 0-based index. Examples:
`rack-01-sw-data-0-p3`, `rackd-02-up1`, `rack-01-srv-01-nic0`, `rackd-01-dn2`.

### Racks sort order

Racks are sorted by `id` string before `d3.pie()` assignment. The generator produces them in numeric order (`rack-01`, `rack-02`, …), which is already sorted. `d3.pie()` is called with `.sort(null)` to preserve that order.

---

## Radii (all multiples of `S`)

| Constant | Value | Description |
|---|---|---|
| `rcS` | `13 * S` | Region controller rect half-size |
| `RC_PORT_R` | `22 * S` | Radius for region controller port squares |
| `R0_INNER` | `30 * S` | Rackd band inner edge |
| `R0_OUTER` | `R0_INNER + 12*S` | Rackd band outer edge (12*S thick) |
| `R0_MID` | `R0_INNER + 6*S` | Rackd port row midline |
| `R2_INNER` | `R0_OUTER + 8*S` | Switch band inner edge (8*S gap after rackd) |
| `R2_OUTER` | `R2_INNER + 16*S` | Switch band outer edge (16*S thick) |
| `R2_MID` | `(R2_INNER + R2_OUTER) / 2` | Switch port row midline |
| `R_SRV_BASE` | `R2_OUTER + 12*S` | Server rectangles base (12*S gap after switch) |
| `SRV_P0_R` | `R_SRV_BASE + PORT_SZ / 2` | Center of innermost server port square |
| `R_SERVER_MAX` | `R_SRV_BASE + 10*S + 4*(PORT_SZ+PORT_GAP) + 2*S` | Outermost possible server port (assumes ≤4 ports per server) |
| `R_LABEL` | `R_SERVER_MAX + 10*S` | Rack label text baseline |
| `R_LABEL_SEP` | `R_LABEL - 6*S` | Full-circle separator arc |

The rack ring (`R1_INNER`, `R1_OUTER`) **does not exist**. Rack angular boundaries are computed internally for switch arc subdivision but nothing is drawn for them.

---

## Angular allocation

### Rack arcs

Use `d3.pie()` to assign equal angular slices per **rack enclosure** (not per rackd):

```js
const rackPie = d3.pie()
  .value(() => 1)
  .sort(null)        // preserve pre-sorted-by-id order
  .padAngle(0.014);  // seam between rack slices

const rackArcs = rackPie(racks);   // racks already sorted by id
```

These arcs drive switch subdivision and server placement. They are **not rendered** as visible shapes.

### Rackd arc span

A rackd's visual arc spans the combined angular range of all its rack enclosures:

```js
function rackdArcSpan(rackd, rackArcById) {
  const arcs = rackd.racks.map(id => rackArcById[id]).filter(Boolean);
  if (!arcs.length) return { startAngle: 0, endAngle: 0 };
  return {
    startAngle: Math.min(...arcs.map(a => a.startAngle)),
    endAngle:   Math.max(...arcs.map(a => a.endAngle))
  };
}
```

### Switch arcs

Computed via a nested `d3.pie()` scoped to each rack's angular span:

```js
function switchArcsForRack(rackArc) {
  if (!rackArc.data.switches.length) return [];
  const pie = d3.pie()
    .value(() => 1)
    .sort(null)
    .startAngle(rackArc.startAngle)
    .endAngle(rackArc.endAngle)
    .padAngle(0.008);   // seam between switches within a rack
  const arcs = pie(rackArc.data.switches);
  arcs.forEach(a => { a.rackId = rackArc.data.id; a.rackdId = rackArc.data.rackdId; });
  return arcs;
}
const allSwitchArcs = rackArcs.flatMap(switchArcsForRack);
```

Switch arcs can **never** drift outside their parent rack's angular span.

---

## Layer structure (DOM order)

```
<g class="layer-region-rack-links">    <!-- Bundle A: region → rackd uplink lines -->
<g class="layer-rack-switch-links">    <!-- Bundle B: rackd → switch uplink lines -->
<g class="layer-switch-server-links">  <!-- Bundle C: switch → server port lines -->
<g class="layer-rackd-ring">           <!-- rackd arc outlines + port squares (translated to cx,cy) -->
<g class="layer-switch-ring">          <!-- switch arc outlines + port squares (translated to cx,cy) -->
<g class="layer-server-bars">          <!-- server rectangles + port columns -->
<g class="layer-rack-labels">          <!-- rack name labels + separator arc (translated to cx,cy) -->
<g class="layer-region-node">          <!-- region controller rect + RC port squares -->
```

`layer-rackd-ring`, `layer-switch-ring`, and `layer-rack-labels` carry `transform="translate(cx,cy)"`. Port positions inside them are stored as **absolute** SVG coordinates; `transform` on each port `<g>` subtracts `cx`/`cy` (`translate(d.x-cx, d.y-cy)`).

Edges are drawn before nodes so node fills cover line stubs. Region node is drawn last.

---

## Ring rendering

### Region controller (`layer-region-node`)

A rounded `<rect>` centered at `(cx, cy)`, half-size `rcS = 13*S`, `rx=4`, filled and stroked `AUBERGINE`. Text "RC" centered inside, font size `max(8, 9*S)px`, fill `#ffffff`.

Region controller port squares sit at radius `RC_PORT_R = 22*S`, one per rackd uplink port. Each port's angle is the angular midpoint of its rackd's arc span; for redundant rackds (2 uplinks), the pair is offset by ±0.05 rad from the midpoint:

```js
const mid   = (rackdArcSpan.startAngle + rackdArcSpan.endAngle) / 2;
const angle = mid + (rackd.uplinkPorts.length > 1 ? (portIdx === 0 ? -0.05 : 0.05) : 0);
```

Port square fill: `LIGHT_GREY`. Stroke: `MID_GREY`, 0.8px.

### Rackd band (`layer-rackd-ring`)

One `d3.arc()` path per rackd, using `R0_INNER`/`R0_OUTER` and the rackd's computed `startAngle`/`endAngle`. **`fill: transparent`** (full interior is a mouse hit target), stroke `MID_GREY`, 1px. Hover: stroke → `HOVER_FILL`.

All rackd ports (uplinkPorts first, then downlinkPorts) share a **single curved row** at `R0_MID`, placed by `wrappedPortPositions`. Port square fill:
- Uplink ports → `AUBERGINE`
- Downlink ports → `DATA_COLOR` or `MGMT_COLOR` matching `downlinkPort.swType`

### Switch band (`layer-switch-ring`)

One `d3.arc()` path per switch, using `R2_INNER`/`R2_OUTER`. **`fill: transparent`**, stroke `DATA_COLOR` or `MGMT_COLOR` by type, 1px. Hover: fill → type color + `'4d'` hex alpha (≈30% opacity).

All switch ports (uplinkPort first, then downlinkPorts) share a single curved row at `R2_MID`, placed by `wrappedPortPositions`. Port square fill:
- Uplink port → `LIGHT_GREY` (visually distinct from downlinks)
- Downlink ports → `DATA_COLOR` or `MGMT_COLOR` per switch type

### Server rectangles (`layer-server-bars`)

Each server is a thin `<rect>` drawn with inner end at `y=0` (local), extending in the `+y` direction, then transformed to point radially outward:

```js
.attr('transform', d =>
  `translate(${d.baseX},${d.baseY}) rotate(${180 + d.angle * 180 / Math.PI})`)
// baseX, baseY = polarAbs(angle, R_SRV_BASE)
```

Dimensions:
- **Width:** `PORT_SZ` (5px — same as port square, no S scaling)
- **Height:** `srvLen = 10*S + portCount * (PORT_SZ + PORT_GAP) + 2*S`
- **rx:** 1
- **fill:** `transparent` · **stroke:** `LIGHT_GREY`, 1px

Hover: fill → `rgba(68,68,68,0.25)`, stroke → `COOL_GREY`.

**Server distribution:** servers for each rack are distributed evenly across the **full rack arc span** (not per-switch), with 3% angular padding at each edge:

```js
rackArcs.forEach(ra => {
  const n    = ra.data.servers.length;
  const span = ra.endAngle - ra.startAngle;
  const pad  = span * 0.03;
  const slot = (span - 2 * pad) / n;
  ra.data.servers.forEach((srv, i) => {
    const angle = ra.startAngle + pad + (i + 0.5) * slot;
  });
});
```

Each server rectangle contains a column of port squares at local positions `localY = 10*S + portIndex * (PORT_SZ + PORT_GAP)`, stepping outward. Server ports are sorted before rendering: data NICs (`type === 'data'`) first, then mgmt BMC ports.

---

## Port glyph spec

| Property | Value |
|---|---|
| Shape | `<rect>` 5×5px, centered (`x=-2.5, y=-2.5`) |
| Corner radius | `rx=1` |
| Default fill | type color: `AUBERGINE`, `DATA_COLOR`, `MGMT_COLOR`, or `LIGHT_GREY` |
| Default stroke | none (RC ports: `MID_GREY`, 0.8px) |
| Hover fill | `HOVER_FILL` |
| Hover stroke | `ACTIVE_STROKE` (#ffffff), 1.5px |
| Ring port rotation | `rotate(angle_deg)` so the square is tangent to the ring curvature |
| Server port rotation | not rotated — aligned to server rect's local y-axis |
| Minimum size | 3px — at wrapping overflow, render at 3px and accept overlap rather than adding a third row |

---

## Port wrapping

When a band's usable arc length is too short to fit all ports in one row:

```js
function wrappedPortPositions(ports, arcStart, arcEnd, bandMidRadius) {
  if (!ports.length) return [];
  const arcSpan   = arcEnd - arcStart;
  const pad       = Math.min(arcSpan * 0.1, 0.04);        // angular padding inside arc edges
  const usable    = Math.max(arcSpan - 2 * pad, arcSpan * 0.5);
  const arcLen    = bandMidRadius * usable;
  const maxPerRow = Math.max(1, Math.floor(arcLen / (PORT_SZ + PORT_GAP)));
  const rowCount  = Math.min(2, Math.ceil(ports.length / maxPerRow));  // cap at 2 rows
  const perRow    = Math.ceil(ports.length / rowCount);

  return ports.map((port, i) => {
    const row      = Math.floor(i / perRow);
    const col      = i % perRow;
    const rowR     = bandMidRadius - row * (PORT_SZ + 2 * S);   // step inward (S-scaled)
    const colCount = (row < rowCount - 1) ? perRow : ports.length - row * perRow;
    const t        = colCount > 1 ? col / (colCount - 1) : 0.5;
    const angle    = arcStart + pad + t * usable;
    return { angle, radius: rowR, ...polarAbs(angle, rowR) };
  });
}
```

Row 0 is outermost (at `bandMidRadius`), row 1 steps inward by `PORT_SZ + 2*S`. Port order is preserved across rows. Bundle line endpoints use the exact `{ angle, radius }` returned here — never a band midline approximation.

---

## Link rendering — bundled port-to-port cables

All link layers use `d3.line().curve(d3.curveBundle.beta(0.75))`. Every link is a `<g>` containing:
1. A **visible `<path>`** — `stroke-width: 0.9`, `opacity: 0.45`, `fill: none`.
2. An **invisible hit `<path>`** — same `d`, `stroke-width: 8`, `stroke: transparent`, `pointer-events: stroke`. Widens hover target to ±4px.

Hovering highlights the visible path: `stroke → HOVER_FILL`, `opacity → 0.85`. All three bundles use the same default stroke weight and opacity — there is no per-layer differentiation.

### Bundle A — Region → Rackd (`layer-region-rack-links`)

One `<path>` per rackd uplink port. From: RC port square position. To: rackd uplink port square position.

For **non-redundant** rackds (1 uplink): midpoint pulled slightly toward center.

For **redundant** rackds (2 uplinks): lines separated by ±`13*S` perpendicular offset, derived from the direction vector between endpoints:

```js
function bundleCtrl(p0, p1, sign) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1;
  const perp = { x: dy / len, y: -dx / len };
  const mid  = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  return { x: mid.x + perp.x * sign, y: mid.y + perp.y * sign };
}
// portIdx 0 → sign = +13*S; portIdx 1 → sign = -13*S
```

Stroke: `COOL_GREY`. Both lines in a redundant pair have identical stroke weight — peer uplinks, not primary/backup.

### Bundle B — Rackd → Switch (`layer-rack-switch-links`)

One `<path>` per switch (= one per entry in `rackd.downlinkPorts`). From: rackd downlink port square. To: switch uplink port square. Midpoint pulled 8% toward center:

```js
const mid = {
  x: (f.x + to.x) / 2 + (cx - f.x) * 0.08,
  y: (f.y + to.y) / 2 + (cy - f.y) * 0.08
};
```

Stroke: `DATA_COLOR` or `MGMT_COLOR` per `downlinkPort.swType`.

### Bundle C — Switch → Server (`layer-switch-server-links`)

One `<path>` per switch downlink port. From: switch downlink port square. To: corresponding server port square in the server rect column. Midpoint pulled 15% toward center:

```js
function swSrvPoints(from, to) {
  const mid  = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const pull = 0.15;
  return [from, { x: mid.x + (cx - mid.x) * pull, y: mid.y + (cy - mid.y) * pull }, to];
}
```

Stroke: `DATA_COLOR` or `MGMT_COLOR` per switch type.

---

## Rack label ring (`layer-rack-labels`)

One label per rack enclosure (not per rackd), placed at `R_LABEL`, beyond all server rectangles.

### Orientation — radial (spoke-style)

```js
function labelTransform(midAngle) {
  const lx   = R_LABEL * Math.sin(midAngle);   // relative to (cx,cy) — layer is translated
  const ly   = -R_LABEL * Math.cos(midAngle);
  const deg  = midAngle * 180 / Math.PI;
  const flip = midAngle > Math.PI;              // left half of circle
  return { lx, ly, rotate: flip ? deg + 180 : deg, anchor: flip ? 'end' : 'start' };
}
```

Applied as `transform="translate(lx,ly) rotate(rotate)"` with `text-anchor` from `anchor` and `dominant-baseline: middle`. Left-half labels flip 180° and right-align, so all labels read outward from center.

### Separator arc

Full-circle arc at `R_LABEL_SEP = R_LABEL - 6*S`, drawn as a `d3.arc()` path from 0 to 2π, `fill: none`, stroke `LIGHT_GREY`, 0.5px.

### Label suppression

```js
const arcLen = R_LABEL * (rackArc.endAngle - rackArc.startAngle);
const fits   = arcLen >= label.length * 5 + 6;   // ~5px per character estimate
text.text(fits ? label : '');   // suppress with empty string, don't remove element
```

Never truncate — always full name or nothing.

---

## No LOD — single render state

No LOD levels. No `lodLevel()` function. No `lod-*` CSS classes. All elements are always rendered regardless of zoom scale. `d3.zoom` is used for pan/zoom navigation only — its `on("zoom")` callback applies `transform` to the root `<g>` and has no other side effects.

`scaleExtent([0.2, 8])`.

---

## Color palette (dark mode)

The D3 code references a `C` object containing only the colors actively used in JavaScript:

```js
const C = {
  AUBERGINE:     '#a64d79',   // region node, rackd uplink port squares, hover title text
  COOL_GREY:     '#999999',   // Bundle A strokes, separator arc
  MID_GREY:      '#666666',   // rackd arc outlines, RC port strokes
  LIGHT_GREY:    '#444444',   // server rect outlines, switch uplink port squares
  DATA_COLOR:    '#0e8420',   // data switch arcs, data port squares, Bundle B/C data lines
  MGMT_COLOR:    '#e88527',   // mgmt switch arcs, mgmt port squares, Bundle B/C mgmt lines
  HOVER_FILL:    '#3c6faa',   // hover fill on arcs, bundle lines, port squares
  ACTIVE_STROKE: '#ffffff',   // stroke on hovered port squares
  TEXT_PRIMARY:  '#cdcdcd',   // rack labels, panel body text
  TEXT_SECONDARY:'#888888',   // secondary metadata
};
```

CSS-only values (not in `C`, set directly in stylesheets):

| Value | Usage |
|---|---|
| `#111111` | `body` background, SVG background |
| `#1d1d1d` | header, legend, detail panel backgrounds |
| `rgba(68,68,68,0.25)` | server rect hover fill |

Path highlighting and filter hiding use CSS classes only:

```css
.path-dimmed  { opacity: 0.08 !important; pointer-events: none;  transition: opacity 200ms ease; }
.path-active  { opacity: 1    !important;                         transition: opacity 200ms ease; }
.filter-hidden { opacity: 0   !important; pointer-events: none !important; }
```

---

## Hover behavior

### Hit areas

- Rackd and switch arcs: `fill: transparent` — entire interior is a pointer-event target.
- Server rectangles: `fill: transparent` by default.
- Bundle lines: invisible 8px-wide hit path (see Link rendering).
- Port squares: solid fill — inherently hoverable.

### Hover state

On `mouseover`, changes apply directly via D3 attribute calls (80ms CSS `transition` is set on the element's style):

| Element | Change on hover | Revert on mouseout |
|---|---|---|
| Region node | fill → `HOVER_FILL` | fill → `AUBERGINE` |
| Rackd arc | stroke → `HOVER_FILL` | stroke → `MID_GREY` |
| Switch arc | fill → type color + `'4d'` (30% opacity) | fill → `transparent` |
| Port square | fill → `HOVER_FILL`, stroke → `ACTIVE_STROKE` 1.5px | revert to type color, stroke none |
| Server rect | fill → `rgba(68,68,68,.25)`, stroke → `COOL_GREY` | fill → `transparent`, stroke → `LIGHT_GREY` |
| Bundle line | visible path stroke → `HOVER_FILL`, opacity → 0.85 | revert to type color, opacity → 0.45 |
| Rack label | fill → `AUBERGINE` (CSS `:hover`) | fill → `TEXT_PRIMARY` |

Hover does **not** trigger path highlighting or dimming.

### Hover inspection panel (`#hover-panel`)

Fixed-position `<div>`, opacity 0 by default, positioned at `(cursor.x + 14, cursor.y - 8)`. Dismissed 100ms after `mouseout` (delay allows moving cursor onto the panel).

Title (`#hp-id`): entity `id` or `portId`, colored `AUBERGINE`, 13px/500.

| Entity | Body rows |
|---|---|
| Port | `label`, `type`, `→ connectedTo` |
| Switch | `type[typeIndex]`, `uplink → connectedTo`, downlink port count |
| Rackd | racks served, uplink count, downlink count |
| Rack label | parent rackd, switch count, server count |
| Server rect | port count |
| Region node | rackd count |

---

## Path highlighting (click-to-focus)

`selectedId` and `selectedType` track selection (null = nothing). Clicking the same entity again clears. Clicking empty SVG space clears.

Active rack/rackd sets computed by ID-prefix derivation (not graph traversal):

| Selected type | Active racks | Active rackds |
|---|---|---|
| `region` | all (no dimming) | all |
| `rackd` | `rackd.racks` | `{selectedId}` |
| `rack` | `{selectedId}` | `rack.rackdId` |
| `switch` | rack ID prefix of selectedId | that rack's rackdId |
| `server` | rack ID prefix of selectedId | that rack's rackdId |

Elements are classified by checking their bound datum's `rackId` / `rackdId` field against the active sets, then `path-active` or `path-dimmed` is applied via `selection.classed()`.

---

## Search & navigation

`#search` input in the header. Search index includes all region, rackd, rack, switch, server, and port entities. Match fields (substring, case-insensitive): `id`, `name` (or `label` for ports stored as `name`), and `connectedTo` (stored as `conn` in index).

Dropdown `#search-dropdown` shows up to 10 matches as `<li>`. Selecting a result:

1. Sets `selectedId` / `selectedType` → path highlighting.
2. Calls `animateZoomTo(cx, cy, scale)` — always zooms to the SVG center at a type-appropriate scale: racks/rackds/region → `1.5`, switches/servers → `2`, ports → `3.5`.
3. Opens the detail panel.

Camera animation: `svg.transition().duration(600).ease(d3.easeCubicInOut).call(zoomBehavior.transform, t)`.

---

## Detail panel (click)

`#detail-panel` — fixed-position `<div>`, `right: 160px` (clears the 155px legend sidebar), `top: 56px`, `bottom: 14px`. Shown on device click, hidden by close button or `clearSelection()`.

Content sections by entity type:

| Entity | Sections |
|---|---|
| Switch | Hardware (id, SW type[typeIndex]), Networking (uplink label→target, downlink count), Peers (first 6 downlinks, "+N more" if overflow) |
| Rack | Hardware (id), Rack info (rackdId, server count), Switches list |
| Rackd | Hardware (id), Racks served, Uplink ports (label→target), Downlink count |
| Server | Hardware (id), Ports list (label → type → connectedTo) |

Clicking a new device replaces panel content without reopening. Coexists with hover panel (hover panel is ephemeral; detail panel persists).

---

## Filtering

Three filters, all `false` by default:

```js
const filters = {
  redundantOnly: false,   // show only Bundle A lines where rackd has ≥2 uplink ports
  dataOnly:      false,   // hide all mgmt arcs, port squares, bundle lines, and server mgmt ports
  mgmtOnly:      false    // hide all data arcs, port squares, bundle lines, and server data ports
};
```

Filters apply class `filter-hidden` to non-matching elements in place — layout never changes. Filters compose with layer toggles: both must pass for an element to be visible.

---

## Controls panel

Two rows in the `#header`:

**Row 1:** Title · `#search` input · separator · "Racks:" label · `#rack-slider` (range 4–24) · `#rack-count` number input (4–24, default 12)

**Row 2:** "Layers:" · six toggle checkboxes · separator · "Filters:" · three filter checkboxes

| Toggle ID | Label | Effect |
|---|---|---|
| `toggle-redundant` | Redundant | In Bundle A: hide `<g>` elements where `portIdx >= 1` |
| `toggle-rackd` | Rack Ctlrs | Hide `layer-rackd-ring`; hide Bundle A and B entirely |
| `toggle-data` | Data | Hide data switch arcs, data port squares on all bands, data Bundle B/C `<g>` elements, data server port squares |
| `toggle-mgmt` | Mgmt | Same for mgmt |
| `toggle-servers` | Servers | Hide `layer-server-bars` entirely |
| `toggle-ports` | Port links | Hide Bundle A, B, and C entirely |

Note: Bundle A and B are hidden when **either** `toggle-rackd` **or** `toggle-ports` is off.

Slider and number input are kept in sync. Changes call `update(N, animated=true, resetZoom=true)`.

---

## Animations and transitions

- **Rack count change (`update`):** `clearSelection()`, `hideDetailPanel()`, zoom reset to `d3.zoomIdentity`, full data regeneration, then `render(topology, animated=true)`.
  - Server `<g>` elements use D3 data joins: enter fades in over **350ms**, exit fades out over **200ms** then removes.
  - Arc paths, labels, and bundle lines update synchronously (no transition on path morphing in the current implementation).
- **Camera navigation:** `d3.easeCubicInOut`, 600ms.
- **Hover state:** 80ms CSS `transition` on `fill` and `stroke`.
- **Path highlight:** 200ms CSS `transition` on `opacity`.
- **Window resize:** 150ms debounce, then `render(currentTopology, animated=true)` — does **not** reset zoom, preserving the user's pan/zoom state.

---

## Typography

| Element | Size | Weight | Color |
|---|---|---|---|
| Rack labels | 8px | 400 | `TEXT_PRIMARY` |
| Port labels (not rendered in current demo) | 7px | 400 | `TEXT_SECONDARY` |
| Hover panel title | 13px | 500 | `AUBERGINE` |
| Hover panel body | 11px | 400 | `TEXT_PRIMARY` |
| Detail panel title | 15px | 500 | `AUBERGINE` |
| Detail panel body | 12px | 400 | `TEXT_PRIMARY` |
| Controls / search | 12px / 11px | 400 | `TEXT_PRIMARY` / `TEXT_SECONDARY` |
| Region node label | `max(8, 9*S)px` | 400 | `#ffffff` |

Ubuntu variable font loaded from local `assets/fonts/`:

```html
<style>
  @font-face {
    font-family: 'Ubuntu';
    src: url('assets/fonts/f1ea362b-Ubuntu[wdth,wght]-latin-v0.896a.woff2') format('woff2');
    font-weight: 100 900; font-style: normal;
  }
  @font-face {
    font-family: 'Ubuntu';
    src: url('assets/fonts/90b59210-Ubuntu-Italic[wdth,wght]-latin-v0.896a.woff2') format('woff2');
    font-weight: 100 900; font-style: italic;
  }
  body, svg text, #hover-panel, #detail-panel, #search, button {
    font-family: 'Ubuntu', sans-serif;
  }
</style>
```

---

## Acceptance checklist

### Data & determinism
- [ ] Same rack count always produces pixel-identical output.
- [ ] No `Math.random()` anywhere.
- [ ] Every `connectedTo` reference is bidirectionally consistent.
- [ ] `rackdGrouping()` pattern: solo, dual, dual, repeating; total rack coverage equals slider value.
- [ ] Switch counts: double data at `i%3===2`, double mgmt at `i%4===3`, no mgmt at `i%7===6`.
- [ ] Server port count per server = `dataCnt + mgmtCnt` for that rack.

### Structure
- [ ] No `d3.forceSimulation` anywhere.
- [ ] `layer-rack-ring` does not exist in DOM or code.
- [ ] No `R1_INNER`, `R1_OUTER` constants.
- [ ] `rackPie.padAngle(0.014)`; switch pie `padAngle(0.008)`.
- [ ] Switch arcs stay inside parent rack's angular span at all rack counts 4–24.
- [ ] Dual-rack rackd arcs span both rack slices continuously.

### Radii & scaling
- [ ] All radii expressed as `N * S` (or derived therefrom); `PORT_SZ` and `PORT_GAP` are unscaled.
- [ ] Rackd band: `12*S` thick; gap to switch: `8*S`; switch band: `16*S` thick; gap to servers: `12*S`.
- [ ] `R_SERVER_MAX = R_SRV_BASE + 10*S + 4*(PORT_SZ+PORT_GAP) + 2*S`.
- [ ] All radii recompute from `window.innerWidth`/`window.innerHeight` on every render.

### Port glyphs
- [ ] Every port object has exactly one rendered 5×5px `<rect>` glyph.
- [ ] All rackd ports in a single `wrappedPortPositions` row (no manual inner/outer split).
- [ ] Rackd uplink ports: `AUBERGINE`; rackd downlink ports: switch type color.
- [ ] Switch uplink port: `LIGHT_GREY`; switch downlink ports: type color.
- [ ] RC port squares at `RC_PORT_R`, angled toward rackd midpoint, ±0.05 rad offset for redundant pairs.
- [ ] `wrappedPortPositions` uses `pad = min(arcSpan*0.1, 0.04)` and row step `PORT_SZ + 2*S`.
- [ ] Maximum 2 rows; minimum port size 3px.
- [ ] Bundle endpoints use actual port positions from `wrappedPortPositions`.

### Links
- [ ] All bundles use `d3.curveBundle.beta(0.75)`.
- [ ] All bundle visible paths: `stroke-width: 0.9`, `opacity: 0.45`.
- [ ] All bundle `<g>` contain a visible path and an 8px transparent hit path.
- [ ] Bundle A: one line per rackd uplink port; redundant pairs offset by `±13*S`.
- [ ] Bundle B: one line per switch; midpoint pulled 8% toward center.
- [ ] Bundle C: one line per switch downlink port; midpoint pulled 15% toward center.
- [ ] All bundles rendered behind arcs and port squares.

### Visual
- [ ] Arc paths (rackd, switch): `fill: transparent`; server rects: `fill: transparent`.
- [ ] Dark backgrounds: `#111111` body, `#1d1d1d` panels.
- [ ] All JS color references use the `C` object.
- [ ] Ubuntu font loaded from `assets/fonts/`; applied globally.

### Server layout
- [ ] Servers distributed across the **rack** arc span (not switch span), 3% angular padding each side.
- [ ] Server rect width = `PORT_SZ` (5px); height = `10*S + portCount*(PORT_SZ+PORT_GAP) + 2*S`.
- [ ] Server rect transform: `translate(baseX,baseY) rotate(180 + angle_deg)`.
- [ ] Server ports sorted: data NICs first, then mgmt BMC ports.

### Labels
- [ ] Labels at `R_LABEL = R_SERVER_MAX + 10*S`, beyond all server content.
- [ ] Radially oriented (spoke); left-half labels flipped 180° and right-aligned.
- [ ] Separator arc at `R_LABEL - 6*S`, full 360°.
- [ ] Suppression: `R_LABEL * arcSpan < label.length * 5 + 6` → empty string (not removed).

### Hover & interaction
- [ ] Arc interiors and server rects hoverable via `fill: transparent`.
- [ ] Bundle lines have 8px transparent hit paths.
- [ ] Hover panel dismisses after 100ms delay.
- [ ] Hover never dims elements — click only.
- [ ] Dimmed elements at `opacity: 0.08`.
- [ ] Clicking same entity twice clears selection.
- [ ] Detail panel replaced (not stacked) on new device click.

### Layout & sizing
- [ ] SVG `viewBox` = `0 0 ${window.innerWidth} ${window.innerHeight}` on every render.
- [ ] Resize debounced 150ms; does not reset zoom.
- [ ] Rack count change resets zoom to `d3.zoomIdentity`.
- [ ] Rack count slider range: 4–24.
- [ ] No LOD levels; no `lod-*` classes.

### Controls
- [ ] Six layer toggles operate per the toggle table above.
- [ ] Bundle A and B hidden when either `toggle-rackd` or `toggle-ports` is off.
- [ ] Three filter checkboxes hide matching elements in place.
- [ ] Filters and toggles compose (both must pass).
