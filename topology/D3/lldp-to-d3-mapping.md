# LLDP-to-D3 Field Mapping

## Scope

This matrix maps the normalized export produced by
`lldp-data/scripts/export_topology_json.py` to the minimum runtime contract in
`d3-topology-contract.md`.

`radial-layered-topology-viz-spec.md` is an **output contract**. Its Pod,
Superspine, Spine, Leaf, Border Leaf, Rack, Server, data-plane, and
management-plane concepts are not treated as facts inherently known by LLDP.

## Classification vocabulary

| Classification | Meaning |
|---|---|
| **Direct** | Copied from an available normalized source field after type decoding/normalization. |
| **Derived** | Computed from one or more source fields, graph structure, or reviewed policy. |
| **Defaulted** | Filled with a D3-safe sentinel because the source lacks a usable value. |
| **Unavailable** | Cannot be established safely without external inventory, configuration, or owner review. |

| Usage class | Meaning |
|---|---|
| **Render-required** | Required for geometry, identity, filtering, or referential validity. |
| **Tooltip** | Useful display context but not required for geometry. |
| **Diagnostics** | Preserved for provenance, reconciliation, quality, and troubleshooting. |
| **External inventory** | Must not be inferred from LLDP alone. |

## Normalized LLDP export contract

The direct source contract is defined by `export_topology_json.py:52-130` and
expanded in `lldp-data/lldp-source-catalog.md`.

| Collection | Source fields | Export transformations | Projection use |
|---|---|---|---|
| `nodes` | `id`, `hostname`, `node_type`, `chassis_id`, `mgmt_ips`, `system_descr`, `vendor`, `model`, `os_name`, `os_version`, `capabilities`, `role` | Nodes without edges are omitted; `mgmt_ips` and `capabilities` remain JSON-encoded strings. | Device identity candidates, label, coarse host/switch evidence, tooltip metadata, diagnostics. |
| `edges` | `local_node_id`, `local_port_name`, `local_mac`, `remote_node_id`, `remote_port_id`, `remote_port_descr`, `mau_type`, `vlan_id`, `native_vlan`, `tagged_vlans`, `vlan_mode`, `vlan_names`, `mfs`, `autoneg_supported`, `autoneg_enabled`, `confirmed_by` | Adds `speed_mbps`, `autoneg_off`, `local_port_key`, `remote_port_key`; decodes VLAN arrays/objects. | Directed observations, canonical physical-link reconciliation, plane evidence, link diagnostics. |
| `bonds` | `node_id`, `member_name`, `mac_address`, `bond_name`, `bond_mode`, `bond_lacp_rate` | Join-derived records from interface membership. | Diagnostics and future LAG grouping; not D3 nodes. |
| `vlans` | Derived from edge native/tagged VLANs | Object keyed by VLAN ID with `vlan_id`, `name`, `count`. | Tooltip/diagnostics and reviewed plane evidence; never a visualization plane by itself. |
| `interfaces` | `node_id`, `name`, `type`, `mac_address`, `link_connected`, `oper_status`, `speed_mbps`, `link_speed_mbps`, `duplex`, `port_mode`, `native_vlan`, `tagged_vlans`, `description` | Adds conservative/effective `speed_mbps`, current lossy `port_key`, and `unused`. | Endpoint validation, port/status diagnostics, reviewed management-interface evidence. |

SQLite-only `nodes.source`, `edges.collected_from`, interface IDs, timestamps,
TTL, and LLDP chassis/port subtypes are not present in the JSON export.

## Graph and meta mapping

| D3 field | Usage | LLDP source | Classification | Transformation/default | External dependency |
|---|---|---|---|---|---|
| module/JSON `nodes` | Render-required | Canonical accepted devices plus approved synthetic containers | Derived | Project devices after reconciliation and role review. | Rack/Pod containers require inventory. |
| module/JSON `links` | Render-required | Canonical physical links plus approved containment relations | Derived | Aggregate observations; orient hierarchy inner→outer. | Rack membership and hierarchy direction require reviewed rules. |
| `meta.source` | Diagnostics | Pipeline constant | Defaulted | `"lldp"`. | None. |
| `meta.dataset` | Diagnostics | Source filename/manifest | Direct | Stable dataset name without extension. | None. |
| `meta.option` | Render/legend | Inferred populated reviewed tiers | Derived | `B`, `C`, or `D` only when non-quarantined role evidence supports it; otherwise block projection. | Network-owner review. |
| `meta.label` | Tooltip/title | Dataset manifest name | Direct/defaulted | Manifest label; fallback to dataset ID. | None. |
| `meta.subtitle` | Tooltip/title | Counts and reviewed option | Derived | Compact source/quality summary. | None. |
| `meta.ringNames` | Render/legend | Projection policy | Defaulted | `{}` unless approved deployment terminology overrides it. | Owner terminology may override. |
| `meta.generated_at` | Diagnostics | Runtime clock | Derived | UTC timestamp in projection report only; excluded from deterministic content hashes. | None. |
| `meta.projection_version` | Diagnostics | Adapter constant | Defaulted | Integer schema version. | None. |
| `meta.source_sha256` | Diagnostics | Source bytes | Derived | Streaming SHA-256. | None. |
| `meta.warnings` | Diagnostics | Profile/reconciliation/classification reports | Derived | Sorted warning strings and exclusion counts. | None. |

## D3 node mapping

| D3 field | Usage | LLDP source | Classification | Transformation | Fallback or unavailable behavior |
|---|---|---|---|---|---|
| `id` | Render-required | `nodes.id`, `chassis_id`, inventory IDs, management addresses | Derived | Apply canonical identity hierarchy from `canonical-topology-model.md`; preserve stable source ID where it is already authoritative and safe. | Deterministic placeholder only in canonical diagnostics; production D3 inclusion requires approved policy. |
| `label` | Render-required | `hostname` | Direct | Trim and escape for display; do not use as identity. | Canonical DeviceId. |
| `ring` | Render-required | `node_type`, coarse `role`, hostname rules, graph structure, model/port profile | Derived | Ordered role inference with confidence/evidence. | Quarantine; never force a plausible ring. |
| `weight` | Render-required | Accepted canonical links and authoritative containment | Derived | Server=1; other nodes use deduplicated downstream server sets. | Reviewed minimum for infrastructure with no discovered servers; report incomplete topology. |
| `plane` | Render-required | Curated mappings, hostname, interface names, reviewed VLANs/subnets, link classifications | Derived/defaulted | Ordered classifier; device becomes `shared` only when reviewed incident evidence covers both data and management. | `"n/a"`; never classify a whole switch from one management-looking host NIC. |
| `leaf_role` | Render/tooltip | Reviewed role inference | Derived/defaulted | `border` only from authoritative mapping or reliable explicit rule; access leaf/TOR → `access`. | `"n/a"`. |
| `trust_tier` | Tooltip | None in normalized LLDP | Unavailable/defaulted | External policy only. | `"n/a"`. |
| `failure_domain_role` | Tooltip | Redundancy and rack/fabric policy | Unavailable/defaulted | LLDP links alone do not establish SPOF/redundancy semantics. | `"n/a"`. |
| `rack_controller_ids` | Tooltip | Controller records may identify controllers but not authoritative rack assignment | Unavailable/defaulted | Populate only from approved inventory relationships. | `[]`. |
| `availability_zone` | Tooltip/color | None | Unavailable/defaulted | Inventory/scheduler assignment only. | `"n/a"`. |
| `metadata.original_id` | Diagnostics | `nodes.id` | Direct | Preserve exactly. | None. |
| `metadata.hostname` | Tooltip | `hostname` | Direct | Preserve source display value. | Null. |
| `metadata.chassis_id` | Tooltip/diagnostics | `chassis_id` | Direct | Preserve raw and canonical comparison value; subtype remains unknown for legacy input. | Null. |
| `metadata.management_ips` | Tooltip | `mgmt_ips` | Direct | Decode JSON string, canonicalize IPs, retain invalid values in diagnostics. | `[]`. |
| `metadata.capabilities` | Tooltip | `capabilities` | Direct | Decode JSON string and normalize set. | `[]`. |
| `metadata.vendor/model/os_*` | Tooltip | matching node fields | Direct | Preserve normalized value and source-null state. | Null. |
| `metadata.system_descr` | Diagnostics/tooltip | `system_descr` | Direct | Preserve raw text; bound tooltip length if needed. | Null. |
| `metadata.inferred_role` | Diagnostics | Role classifier | Derived | Role, ring, confidence, ordered evidence, rule version, quarantine flag. | Required for every projected node. |
| `metadata.plane_classification` | Diagnostics | Plane classifier | Derived | Plane, confidence, reason, evidence, conflicts. | Required; unknown remains `n/a`. |
| `metadata.provenance` | Diagnostics | Node/source dataset and contributing observations | Derived | Source filename/hash and canonical observation references. | Required for auditability. |
| `metadata.rack` / `metadata.pod` | Render filtering/Stack View | None reliable in LLDP export | Unavailable | Only approved inventory or stable synthetic grouping. | Omit and block Stack View if unavailable. |
| `metadata.cidr` | Stack View | None reliable in LLDP export | Unavailable | Approved pod/IPAM allocation only. | Omit; do not enable Stack View. |

### Role-to-ring projection rules

| Evidence/result | D3 projection | Classification | Confidence rule |
|---|---|---|---|
| `node_type=machine` or coarse `role=host` | R6 Server | Derived, usually direct coarse evidence | High unless contradictory infrastructure evidence exists. |
| Access switch with predominant direct host neighbors | R4 Leaf/TOR | Derived | High at ≥50% host-neighbor ratio; otherwise medium. Leaf versus TOR remains option terminology. |
| Switch connected to inferred R4 devices and few/no hosts | R3 Spine | Derived | Medium; owner review required. |
| Higher-tier switch connected to inferred R3 devices | R2 Superspine | Derived | Low and quarantined unless authoritative/explicitly named. |
| Explicit reviewed WAN/DCI/border mapping | R4 Border Leaf | Derived | Authoritative/high preferred; unreviewed name rule is provisional. |
| Physical rack assignment | R5 Rack | Unavailable | Must come from inventory/configuration. |
| Site/fabric/pod grouping | R1 Pod | Unavailable | Must come from inventory or approved stable grouping. |
| Controller records | Node metadata | Derived/defaulted | Do not render as normal topology nodes without explicit requirement. |
| Ambiguous device | Quarantine | Defaulted policy | No ring is emitted. |

Empty tiers are never synthesized merely to make an Option D graph.

## D3 link mapping

| D3 field | Usage | LLDP source | Classification | Transformation | Fallback/unavailable behavior |
|---|---|---|---|---|---|
| `source` | Render-required | Canonical adjacency endpoint devices plus hierarchy roles | Derived | Select inner/parent endpoint; LLDP local direction is provenance, not hierarchy. | Exclude from rendered hierarchy with reason if orientation is ambiguous. |
| `target` | Render-required | Canonical adjacency endpoint devices plus hierarchy roles | Derived | Select outer/child endpoint. | Same as `source`. |
| `plane` | Render-required | Plane classifier | Derived/defaulted | `data`, `mgmt`, or `shared` from reviewed evidence. | `n/a` is valid for node classification but not a D3 LinkPlane; unknown links remain diagnostics until policy resolves them. |
| `type` | Render-required | Endpoint rings and relation policy | Derived | Adjacent tier → `routing_adjacency`; R5→R6 inventory membership → `containment`; approved same-tier relation → `peer_adjacency`. | Non-adjacent/unknown relations remain diagnostics. |
| `weight` | Render-required | View policy | Defaulted | `1` for one rendered logical relationship. | None. |
| `metadata.physical_links` | Diagnostics/tooltip | Reconciled edge observations | Derived | Preserve every underlying endpoint/port pair, direction, `confirmed_by`, speed, VLAN, status, and source reference. | `[]` only for synthetic containment with explicit provenance. |
| `metadata.directionality` | Diagnostics | Opposite directed observations | Derived | `bidirectional`, `one_way`, or `conflicting`. | `one_way` for single valid assertion. |
| `metadata.ports` | Tooltip/diagnostics | Local/remote raw port fields | Direct/derived | Preserve raw IDs/descriptions and conservative canonical keys; never use lossy keys as sole identity. | Null per endpoint when genuinely absent. |
| `metadata.vlans` | Diagnostics | Native/tagged VLAN fields | Direct | Sorted metadata only. | Empty lists; VLANs do not create visualization planes. |

Parallel physical links between the same device pair are aggregated only for
the D3 view because the current renderer keys links by device endpoint pair.
The canonical links remain distinct and are listed in `physical_links`.

## Plane classification contract

The tested classifier applies evidence in this order:

1. authoritative device mapping;
2. curated hostname mapping;
3. management-interface convention on an infrastructure endpoint;
4. reviewed management VLAN/subnet mapping;
5. host/access role pair → data;
6. unknown → `n/a`/diagnostic exclusion.

Conflicting evidence returns `n/a` with `conflict=true`; it is never resolved by
arbitrary precedence. A management-looking interface on a host does not make
the host or its switch a management-plane device. Device plane is summarized
from incident classified links: data-only, mgmt-only, both→shared, none→n/a.

Management links are currently retained in analysis but disabled for radial
rendering pending owner review. Management VLAN/subnet lists are intentionally
empty in `lldp-data/analysis-rules.json`.

## Required projection gates

Projection cannot be declared production-ready until all are true:

- authoritative machine→rack assignment is supplied;
- switch role mappings are reviewed by a network owner;
- pod/site grouping is supplied or explicitly approved as synthetic;
- management device/interface/VLAN/subnet rules are approved;
- unresolved-node inclusion policy is approved;
- parallel-link presentation policy is approved;
- selected option and management-link visibility are approved.

Until then, profiling, reconciliation, and classifications are complete and
reproducible, but D3 ring/plane assignments remain explicitly provisional.

## Implemented evidence

- Rules: `lldp-data/analysis-rules.json`
- Profiler/reconciler/classifiers: `lldp-data/scripts/analyze_topology.py`
- Tests: `lldp-data/tests/test_analyze_topology.py`
- Generated reports: `lldp-data/reports/`
