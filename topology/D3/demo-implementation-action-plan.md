# Action Plan: D3 Demo — Radial Layered Topology Visualization (Option C)

**Companion document to:** `radial-layered-topology-viz-spec.md` (design specification — read that first; this document sequences its implementation and adds visual-brand requirements not covered there).

**Handoff note for the implementing agent (e.g. Copilot):** the spec defines *what* to build and *why*; this plan defines *in what order* and *to what visual standard*. Where the two conflict, the spec governs structure/behavior and this document governs styling/sequencing. Flag any conflict rather than silently resolving it.

---

## 1. Objective

Build a single working demo of the radial layered graph with hierarchical edge bundling, scoped to **Option C (standard leaf-spine datacenter pod)** only — per the spec, Option C is the smallest instance containing every element at once: pod, spine, leaf (data + management planes), border leaf, rack, server, dual-leaf redundancy, and ECMP fan-out.

Explicitly **not** in scope for this demo (per prior decisions):
- Options A, B, D and the A↔D scale transition/slider.
- Global crossing-minimization beyond per-ring barycenter.
- 3D pod-stacking.
- OOB, trust-tier, failure-domain, BGP-aggregation categorization layers (§7 of the spec) — stub the data fields but do not render them yet.
- Border leaf satellite glyph — stub only if trivial, otherwise skip.

## 2. Tech Stack

- **D3.js (v7)**, loaded via ES module import — no bundler required for the demo; a single static HTML page is sufficient.
- Plain **SVG** rendering (no Canvas/WebGL) — arc and link counts at Option C scale are well within SVG's comfortable range, and SVG keeps hover/tooltip interaction simple.
- No frontend framework (no React) — this is a standalone demo artifact, not part of a larger app shell. Keep it a single HTML file plus one or two JS modules and one CSS file, so it's trivial to open directly in a browser.
- `d3-shape` (arc, ribbon/link generators), `d3-scale`, `d3-hierarchy` is **not** used for layout (it forces single-parent trees — see spec §1.1) but its `d3.arc()` and radial helpers are still useful for drawing individual ring segments.

## 3. Project Structure

```
/demo
  index.html
  /js
    data.js          -- Option C fixture data (nodes + links, per spec §9.1 schema)
    layout.js         -- ring assignment, angular position, weight → arc-width
    bundling.js        -- hierarchical edge bundling path generation
    render.js         -- D3 draw calls: rings, arcs, links, labels
    interaction.js      -- hover/focus, plane toggles (§8.2, §8.3)
  /css
    style.css         -- Canonical/Ubuntu visual styling (§6 below)
  /assets
    fonts/            -- Ubuntu font files (self-hosted, see §6.2)
```

Keep modules small and single-purpose so individual pieces (e.g. bundling.js) can be reviewed or swapped independently.

## 4. Implementation Phases

Build in this order. Each phase should be independently viewable/testable before moving to the next — don't build bundling before plain links render correctly, don't style before geometry is right.

### Phase 0 — Fixture data
Hand-author a JSON/JS fixture for one representative Option C pod:
- 1 pod
- 2 data spines, 2 mgmt spines (small but real Clos, enough to show ECMP fan-out)
- 4 data leaves, 4 mgmt leaves
- 6 racks, 3 dual-leaf and 3 single-leaf (to exercise both the multi-parent case and the leaf=rack-failure-domain case)
- ~4–8 servers per rack (enough to see arc subdivision at the outer ring without visual overload)
- 1 border leaf (data), stub node only
Follow the node/link schema in spec §9.1 exactly, including `plane`, `weight`, `trust_tier` fields even though several aren't rendered yet — this avoids a schema migration later.

### Phase 1 — Static ring geometry (no links yet)
Implement §3 (ring model) and §5 (layout algorithm) minus bundling:
- Ring radii per spec §3.1/§5.3, flipped order (Region innermost → Server outermost; for Option C this means Pod innermost of the populated set, then Spine, Leaf, Rack, Server outermost).
- Per-ring weight-proportional angular sizing (§5.2, step 1–3), default `weight_mode: deduplicated_server_count`.
- Rack↔leaf angular alignment (§5.2 step 5, the resolved decision) — implement this now, not as a later refinement, since it affects link geometry in every later phase.
- Render arcs only, flat single color per ring, to confirm proportions and alignment look right before adding any visual complexity.

### Phase 2 — Plain (unbundled) links
- Draw straight or simple-curved radial links for every parent/child relationship in the fixture, per §6.1.
- Confirm dual-leaf racks correctly show two incoming links (§6.5) with no special-case code — this is the key structural test that the ring/link separation actually solved the multi-parent problem.
- Apply plane color coding (§6.2): data = blue family, management = green family, physical containment = neutral grey.
- No bundling yet — this phase exists to validate correctness before visual compression is layered on.

### Phase 3 — Hierarchical edge bundling
- Implement bundling per §6.4: group by shared ancestry, generate spline paths, tune `bundle_strength` (default 0.7).
- Verify per-plane bundling independence (data and management bundles must never merge into a shared trunk, per §6.4 point 4).
- This is the highest-risk phase technically — budget the most review time here. If bundling quality is poor, it's acceptable to ship the demo with `bundle_strength` lower (more separated curves) rather than force a bad bundle.

### Phase 4 — Interaction
- Hover/focus behavior (§8.3): highlight connected links, de-bundle to full strand resolution on hover, dim unrelated elements.
- Plane toggles (§8.2): show/hide data and management link sets independently. OOB toggle can be stubbed/disabled for this demo.
- Label degradation (§8.4) is likely unnecessary at Option C's scale — implement only if the server ring gets visually crowded in practice.

### Phase 5 — Canonical/Ubuntu visual styling
Apply the full visual treatment per §6 below. Do this after geometry and interaction are functionally correct — styling a broken layout wastes effort.

### Phase 6 — Polish pass
- Legend (plane colors, ring labels).
- Simple title/header treatment.
- Sanity-check against the spec's §9.1 schema one more time to confirm no ad-hoc fields crept in during implementation without being reflected back.

## 5. Acceptance Checklist for the Demo

- [ ] All rings for Option C render with correct relative proportions and no dead radius bands.
- [ ] Dual-leaf racks show two link bundles into the rack arc; single-leaf racks show one.
- [ ] Data-plane and management-plane links are visually distinguishable and independently toggleable.
- [ ] Rack and leaf arcs are angularly aligned (short, near-radial rack↔leaf links).
- [ ] Hovering any node highlights and de-bundles its connections without a full page re-render stutter.
- [ ] Visual style reads as "Canonical/Ubuntu," not generic/default D3 (see §6 acceptance notes).
- [ ] No console errors; works opened as a static file (or via a trivial static server) without a build step.

---

## 6. Visual Style: Canonical / Ubuntu Brand Fit

### 6.1 Color palette

Use Canonical's official brand palette as the base, applied to the plane/ring color roles defined in the spec. Do not invent new brand colors; derive everything below from official tints of these:

| Role | Base color | Hex | Notes |
|---|---|---|---|
| Primary brand accent (community signal) | Ubuntu Orange | `#E95420` | Reserve for primary emphasis only — active/selected states, primary legend key, not full backgrounds. |
| Secondary brand accent (commercial/enterprise signal) | Aubergine | `#772953` | Good candidate for the **management-plane** link color family, since it reads as "more formal/controlled" against orange's "community/data" feel — but confirm this pairing looks right once rendered; swap if contrast against the background fails. |
| Neutral base | Warm grey / text grey | Use Canonical's warm grey tints (not a cold/blue grey) | For physical-containment "skeleton" links (§6.2 of spec) and inactive/dimmed states (§8.3 focus dimming). |
| Background | White | `#FFFFFF` | Canonical brand guidance treats white as the clean/light base — use as the canvas background, not off-white or dark mode, for brand fidelity in this first demo. |
| Text | Black or warm grey, per Canonical guidance | `#000000` for primary labels, warm grey tint for secondary/tertiary labels | |

**Derived roles for this visualization specifically** (map spec §6.2 plane colors onto brand tints, since the spec's "blue/green/amber/grey" was placeholder language, not a brand decision):

| Spec role | Suggested brand-derived color |
|---|---|
| Data-plane links | Ubuntu Orange, at a lighter tint (e.g. the ~60–70% tint of `#E95420`) for the resting/unbundled-trunk state, full-strength `#E95420` on hover/focus |
| Management-plane links | Aubergine, similarly tinted for resting state, full `#772953` on hover/focus |
| Physical containment "skeleton" links | Warm grey, light tint, always subdued — these should visually recede behind the plane-colored links |
| OOB links (stub only, not rendered this demo) | Reserve a distinct hue for later — do not use orange or aubergine for it, since both are already claimed |
| Ring arc fills | Warm grey tints, graduated slightly lighter toward the outer (server) ring, so the palette doesn't compete with the link colors sitting on top of it |

Use the official tint percentages published in Canonical's palette (each brand color has defined 10–100% tints) rather than arbitrary opacity — this keeps every shade "on-palette" rather than an arbitrary CSS `opacity` fade, which matters for brand fidelity.

**Accessibility note:** Canonical's own design system work on this palette specifically addresses perceptual contrast (their public writing on this references APCA-informed palette generation) — when picking tint pairs for text-on-fill or link-on-background, favor pairs with clearly distinct perceptual lightness, not just distinct hue, so the demo holds up for colorblind or low-vision viewers.

### 6.2 Typography

- **Primary typeface: Ubuntu** (the Canonical/Dalton Maag typeface family — weights Light, Regular, Medium, Bold), for all UI text: titles, ring labels, legend, tooltips.
- **Monospace: Ubuntu Mono**, for any technical/identifier text if it appears in tooltips (e.g. rack IDs, IP-like labels) — gives a "network engineering console" feel appropriate to the content.
- Self-host the font files under `/assets/fonts` (via `@font-face`) rather than relying on a live Google Fonts CDN call, since this network environment's implementation target may not have outbound access to font CDNs at demo time — build it to work offline.
- Fallback stack: `"Ubuntu", "Ubuntu Mono", -apple-system, "Segoe UI", sans-serif` for graceful degradation if fonts fail to load.
- Type scale: keep it simple for a demo — one size for the title, one for ring/section labels, one smaller size for arc labels and tooltips. Don't over-engineer a full type scale for a single-page demo.

### 6.3 Overall visual language

- Favor **flat fills, no gradients, no drop shadows** — Canonical's Suru/Vanilla visual language is clean and flat, not skeuomorphic. Avoid default D3/Bootstrap-looking shadows or 3D bevel effects on arcs.
- Generous white space around the chart; the radial diagram should sit on a plain white canvas, not a boxed/bordered panel, consistent with the "clean, fresh, light" brand description.
- Legend and toggles (plane show/hide) should look like simple flat pill/chip toggles in brand colors, not default browser checkboxes.
- Avoid rounded-corner skeuomorphic buttons; Canonical's UI language (Vanilla framework) tends toward minimal, slightly squared, flat components — if unsure on a specific component style, default to the plainest possible flat treatment rather than guessing at ornamentation.

### 6.4 What "on-brand" acceptance looks like

The demo should look like it could plausibly sit inside a Canonical product page or the Vanilla framework's own documentation site — orange and aubergine used sparingly and purposefully (as data/management distinction, not decoration), warm grey doing the structural heavy lifting, white background, Ubuntu typeface throughout. It should **not** look like a stock D3 example (default category10 rainbow colors, Arial/system-ui font, drop-shadowed nodes).

---

## 7. Instructions for the Implementing Agent

1. Read `radial-layered-topology-viz-spec.md` in full before starting Phase 0 — this plan assumes familiarity with its section numbers.
2. Work phase-by-phase per §4 above; don't skip ahead to styling before geometry/links are verified correct.
3. If any spec requirement is ambiguous or under-specified for a concrete implementation decision (e.g. exact bundling spline parameters), make a reasonable choice, note it in a code comment, and flag it back rather than silently guessing at something structurally important.
4. Keep the fixture data (Phase 0) realistic to Option C as described in the reference architecture, not arbitrary placeholder data — the dual-leaf/single-leaf mix and ECMP fan-out are the whole point of the demo.
5. This is a demo, not a production build: prioritize getting all six phases working end-to-end over polishing any single phase to production quality.
