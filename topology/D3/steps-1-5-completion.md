# Refreshed Steps 1–5 Completion Audit

Audit date: 2026-08-13

## Status

| Step | Engineering implementation | Generated evidence | Production acceptance |
|---|---|---|---|
| 1. Canonical contracts and mapping | Complete | Complete | Complete for available fields; external-only fields explicitly unavailable |
| 2. Streaming profiles | Complete | Complete for all four datasets | Complete |
| 3. Source-quality reconciliation audit | Complete | Complete for all four datasets | Complete as an audit; no source records silently deleted |
| 4. Topology-role inference | Complete and tested | Complete for all four datasets | **Blocked on network-owner review and rack/pod inventory** |
| 5. Plane classification | Complete and tested | Complete for all four datasets | **Blocked on network-owner review of mappings and visibility policy** |

## Step 1 evidence

- Source contract: `lldp-data/lldp-source-catalog.md`
- D3 runtime contract: `d3-topology-contract.md`
- Canonical semantics: `canonical-topology-model.md`
- Direct/derived/defaulted/unavailable field matrix:
  `lldp-to-d3-mapping.md`
- The mapping separates render-required, tooltip, diagnostics, and external
  inventory fields and treats the radial specification as an output contract.

## Step 2 evidence

- Streaming implementation: `lldp-data/scripts/analyze_topology.py`
- Bounded sampler: `lldp-data/scripts/sample_json.py`
- Machine-readable and Markdown profiles:
  `lldp-data/reports/<dataset>.profile.{json,md}`
- Cross-dataset comparison:
  `lldp-data/reports/cross-dataset-comparison.{json,md}`
- Each profile contains collection counts, node/role/hostname/vendor/model
  frequencies, endpoint types, VLAN modes, interface speeds, scoped null rates,
  quality counts, first samples, deterministic node samples, confirmation-type
  edge samples, and bounded interface samples by vendor/model.

## Step 3 evidence

- Reconciliation summaries:
  `lldp-data/reports/<dataset>.reconciliation.{json,md}`
- Complete decision/provenance ledgers:
  `lldp-data/reports/<dataset>.reconciliation-records.ndjson`
- Every source edge has an accepted/rejected decision and reasons.
- Every canonical physical-link group lists all contributing
  `edges.item[N]` references and provenance.
- Reports include duplicate identity groups, conservative unordered physical
  keys, exact/directed/physical duplicate counts, opposite-direction status,
  contradictory ports, normalization collisions, parser artifacts, unresolved
  classifications, and interface/LLDP/confirmation correlation.

Summary:

| Dataset | Raw edges | Accepted | Rejected | Canonical links | Unresolved nodes |
|---|---:|---:|---:|---:|---:|
| `topology_data` | 1,952 | 1,909 | 43 | 1,803 | 22 |
| `topology_tor3` | 1,952 | 1,909 | 43 | 1,803 | 22 |
| `topology_tor3-detailed` | 3,051 | 2,449 | 602 | 1,840 | 16 |
| `turing` | 334 | 334 | 0 | 226 | 7 |

## Step 4 evidence

- Versioned ordered rules: `lldp-data/analysis-rules.json`
- Classifier: `infer_roles()` in `lldp-data/scripts/analyze_topology.py`
- Per-node role/ring/confidence/evidence results:
  `lldp-data/reports/<dataset>.classification.json`
- Human-readable summaries:
  `lldp-data/reports/<dataset>.classification.md`
- Rules apply authoritative mapping, explicit hostname rules, connectivity,
  model/port evidence, coarse LLDP role, then quarantine.
- Controllers are classified as metadata/quarantine unless explicitly enabled.
- Empty conceptual tiers are not created.
- Low-confidence inferred superspines are quarantined and cannot promote the
  selected D3 option.

Current provisional option assessments:

- `topology_data`: Option C
- `topology_tor3`: Option C
- `topology_tor3-detailed`: Option C
- `turing`: Option B

These assessments are reproducible but not operationally approved. The source
contains no authoritative machine→rack or site→pod mapping, and the required
network-owner review has status `required`.

## Step 5 evidence

- Versioned ordered rules: `lldp-data/analysis-rules.json`
- Classifier: `classify_link_plane()` in
  `lldp-data/scripts/analyze_topology.py`
- Per-dataset counts, confidence, evidence, conflicts, and bounded link
  classifications: `<dataset>.classification.json`
- Management-looking interfaces are considered only on infrastructure
  endpoints; a host `eth0` does not classify its switch as management-plane.
- Conflicting evidence returns `n/a` rather than being forced.
- Device `shared` status is derived only from both data and management incident
  link evidence.
- VLAN detail remains metadata; management VLAN/subnet lists are empty pending
  review.
- Management links are analyzed but not enabled for radial rendering.

| Dataset | Unknown-plane links | Plane conflicts |
|---|---:|---:|
| `topology_data` | 196 | 21 |
| `topology_tor3` | 196 | 21 |
| `topology_tor3-detailed` | 222 | 21 |
| `turing` | 72 | 0 |

## Verification

- Automated tests: 20 passing
- Report output is deterministic across repeated runs
- Every source edge is covered by a reconciliation ledger decision
- Every canonical physical link is covered by a complete provenance group
- Largest dataset analysis remained bounded at approximately 33.6 MiB peak RSS
- No known CVEs were found for `ijson==3.5.1`

## Required external decisions

Engineering work for Steps 1–5 is complete. Production acceptance of Steps 4
and 5 cannot be honestly asserted until a network owner updates and approves
`lldp-data/analysis-rules.json`, specifically:

1. authoritative rack assignment for machines;
2. authoritative leaf/TOR, spine, superspine, and border mappings;
3. pod/site grouping;
4. management devices, interfaces, VLANs, and subnets;
5. unresolved-device inclusion policy;
6. management-link rendering policy.

