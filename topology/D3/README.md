# D3 topology fixtures

The reference options in `data/reference` are hand-authored modules. The LLDP
datasets in `data/lldp` are normalized into the same module contract before the
browser loads them:

```bash
node topology/D3/scripts/generate-lldp-fixtures.mjs
```

The command reads `data/lldp/datasets.json`, validates each listed topology,
and writes static modules plus an index to `data/generated/lldp`. Open
`topology/D3/index.html` through an HTTP server after generating fixtures; the
extra LLDP tabs use those generated modules just like the reference options.
Generated artifacts are ignored by Git. When they are absent, the page omits
the LLDP tabs and continues with the reference fixtures.

The scraped TOR 3 MAAS UI export is kept separately from LLDP topology data.
Generate its compact enrichment-only artifact with:

```bash
node topology/D3/scripts/filter-maas-ui-enrichment.mjs
```

The command reads the ignored raw export at
`data/lldp/tor3_maas-ui.json` and writes
`data/generated/maas/tor3-maas-ui-enrichment.json`. The artifact contains
machine identity, zone/pool placement, and compact endpoint
status/capacity fields only; it excludes UI actions, permissions, test state,
addresses, MACs, controllers, and devices.

When present, the LLDP fixture generator automatically joins this artifact to
source nodes by `system_id`, falling back to hostname. Matched compact records
are emitted as node `metadata.maas`. A source node's MAAS zone becomes its
`availability_zone`; inferred rack nodes receive a zone only when all attached
enriched endpoints share one. This activates the existing rack AZ coloring and
endpoint/rack AZ inspector treatment without changing LLDP hierarchy inference.

The adapter at `js/lldp-adapter.js` preserves raw source IDs and aggregates
reverse/parallel LLDP observations. It adds only the synthetic topology root
and logical rack nodes necessary for the radial D3 hierarchy. Diagnostics in
each fixture's `meta.diagnostics` record discarded malformed, dangling, and
self-referential observations.

Generated LLDP fixtures use schema version 3. They preserve evidence without
copying the full source export into browser modules:

- Node `metadata.inventory` includes vendor, model, operating system,
  capabilities, routing capability, and a management-IP count. Raw management
  IP addresses are deliberately excluded.
- Node `metadata.interfaceSummary`, `metadata.resiliency`, `metadata.resolution`,
  and `metadata.sourceQuality` retain compact interface, bond, unresolved-peer,
  and parser-artifact evidence. Bond observations do not imply a renderer
  failure-domain classification.
- Physical link metadata includes only observed participating
  `portDetails`, VLAN and port evidence, and `planeEvidence`. A VLAN explicitly
  named `mgmt` marks that physical link as management; hostname-based `manlan`
  classification remains the fallback.
- Nodes and links include compact `provenance` (`observed`, `inferred`, or
  `synthetic`) for the investigation UI. LLDP links also receive stable IDs,
  allowing persistent selection without deriving identity from display labels.
- Fixture-level `meta.sourceQuality` summarizes unresolved nodes, parser
  artifacts, explicit router roles and routing-capable nodes, evidence coverage,
  and named-management VLAN links.

The adapter continues to derive Core/Transit, Fabric, and Access/ToR rings from
deduplicated physical adjacency and endpoint hop distance. Evidence enrichment
does not alter that inferred hierarchy.

The page keeps the radial Disc and Stack layouts intact while adding an
investigation layer around them: pointer zoom/pan, hostname/source-ID search,
inspector-pinned node/link inspection, and zoom-aware endpoint detail. The
inspector labels observed, inferred, and synthetic objects and
uses only the generated privacy-safe metadata.

Dataset selection, operational view, and search/reset live in one top-level
control center. The footer contains the contextual legend: availability zones
in Topology view and the active operational lens otherwise. Its full-width,
wrapping layout keeps variable-length status or tenancy labels from displacing
controls.

When the LLDP topology yields multiple inferred frames or halls, the generator
also emits `meta.stackView` group metadata. The page uses it to show the Stack
View overview and lets each group column filter the Disc View. Datasets with
only one inferred group stay in the Disc View.

## MAAS operational lenses

When the active fixture contains matched `metadata.maas` endpoint records, the
page exposes a default-off operational view below search. It can highlight
lifecycle status, CPU, memory, storage, or tenancy without
changing Disc geometry or Stack physical grouping. In the default **Topology**
view, server arcs are filled with their availability-zone color. An operational
view replaces only those server fills; racks retain their physical/AZ encoding.

The inspector provides the color-independent detail: match state, zone, pool,
lifecycle and power state, architecture, and MAAS-reported capacity. An absent
match is explicitly shown as **Unmatched**; it is not an operational failure.
Capacity colors use per-fixture relative bands, so they support comparison
within a topology rather than reporting absolute capacity units.

Lifecycle values are normalized to MAAS's canonical status keys and labels.
The legend lists only statuses present in the active fixture, while its colors
group related states and sort them by health: failed/broken in red, transitional
operations in purple, deployed/allocated/reserved in green, ready/new in blue,
and inactive states in gray.

The Stack View compresses these endpoint lenses into its physical rack cells.
Lifecycle uses a conservative precedence (failed/broken, then transitioning,
then the dominant active or ready state); resource lenses use the median matched
server value against the same fixture-wide bands as Disc View; Tenancy uses a
pool only when it represents at least 75% of matched servers, otherwise showing
a neutral mixed-tenancy cell. Stack hover summaries report match coverage and
the relevant rack health, resource, or tenancy breakdown.
