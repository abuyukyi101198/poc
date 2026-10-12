# Canonical Topology Model

## Status and scope

This document defines the canonical semantics for converting LLDP evidence
into topology as of 2026-08-13. It is the stable boundary between source
normalization and presentation-specific adapters.

The model is deliberately richer than the D3 payload:

- a **device** is a graph node;
- an **interface** is an addressable endpoint owned by a device, not a graph
  node in the current visualization;
- a directed **observation** is immutable source evidence;
- an undirected **adjacency** is a reconciled relationship derived from one or
  more observations;
- an **anomaly** records rejected, conflicting, or ambiguous evidence.

The available repository contains normalized exports rather than raw LLDP
captures. Fields that require future collectors (ID subtypes, timestamps, TTL)
are included in the canonical model but remain nullable for legacy input.

## Normative principles

1. **Device-centric graph:** one canonical node represents one logical network
   device. Interfaces never silently become device nodes.
2. **Evidence is preserved:** normalization does not overwrite raw values, and
   reconciliation does not delete the observations that produced a link.
3. **Typed identity:** chassis and port identifier subtypes are part of
   identity. A MAC-looking string is not assumed to be a MAC when its subtype
   is unavailable.
4. **No silent guessing:** unresolved endpoints, collisions, and malformed
   records become explicit anomalies or placeholders.
5. **Stable, deterministic keys:** equivalent input produces the same keys and
   ordering regardless of collection or database row order.
6. **Presentation separation:** rings, planes, arc weights, colors, and D3 link
   aggregation are adapter concerns, not canonical identity.
7. **Parallel links survive:** different interface endpoint pairs represent
   different adjacencies even when the device pair is the same.

Normative terms **MUST**, **SHOULD**, and **MAY** are used in their usual RFC
sense.

## Aggregate structure

```text
CanonicalTopology
  schema_version: string
  devices: Device[]
  interfaces: Interface[]
  observations: DirectedObservation[]
  adjacencies: Adjacency[]
  anomalies: Anomaly[]
  identity_aliases: IdentityAlias[]
  source_batches: SourceBatch[]
```

`generated_at` MAY be emitted in a run report, but SHOULD NOT be embedded in
the canonical content used for deterministic comparison or hashing.

## Device semantics

### What a device represents

A Device represents one logical LLDP system/chassis endpoint. It may be a
switch, router, host, controller, appliance, or unresolved remote system.

Physical stack members and virtual chassis require explicit relationships:

- if members advertise one shared chassis identity, they are one logical
  Device unless authoritative inventory supplies stable member identities;
- if members have distinct chassis identities, they remain distinct Devices
  and MAY share a `logical_group_id`;
- multiple chassis IDs MUST NOT be merged merely because their names match;
- duplicate chassis IDs assigned to inventory-proven separate devices are an
  identity conflict, not an automatic merge.

### Device record

```text
Device
  id: DeviceId
  resolution_status: resolved | provisional | placeholder | conflicted
  identity_confidence: authoritative | high | medium | low | none
  primary_identifier: Identifier
  identifiers: Identifier[]
  names: Name[]
  management_addresses: ManagementAddress[]
  capabilities: string[]
  role: switch | router | host | controller | appliance | unknown
  vendor: string | null
  model: string | null
  os_name: string | null
  os_version: string | null
  logical_group_id: string | null
  source_refs: SourceRef[]
  attributes: object
```

Every raw value that contributes to an identifier, name, address, or derived
classification MUST be traceable through `source_refs` or the corresponding
value object's `raw_value` and `source_ref`.

### Identifier record

```text
Identifier
  kind: chassis | inventory | management_address | system_name | placeholder
  subtype: string
  normalized_value: string
  raw_value: string | null
  authority: string | null
  usable_for_identity: boolean
  source_ref: SourceRef
```

Known LLDP chassis subtypes SHOULD use IEEE names such as `mac_address`,
`network_address`, `interface_name`, `interface_alias`, `chassis_component`,
`locally_assigned`, or `unknown`.

## Device identity hierarchy

Identity selection is deterministic and is evaluated in this order:

1. **Typed, valid chassis identifier.** Prefer a normalized chassis ID with a
   retained LLDP subtype. MAC and network-address subtypes must pass syntax
   validation. Empty, broadcast, multicast where inappropriate, all-zero, and
   vendor sentinel values are not usable.
2. **Authoritative inventory/device ID.** Use a stable MAAS system ID, asset ID,
   or other source-owned immutable key. The authority namespace is part of the
   identifier, for example `maas:system_id`.
3. **Legacy untyped chassis identifier.** A normalized `chassis_id` from the
   current exports may be used provisionally only when it is unique in the
   dataset and does not conflict with authoritative inventory. Its subtype is
   `unknown`, even when the text resembles a MAC.
4. **Unique management address.** Use only a globally canonical address that is
   unique within the applicable inventory scope and has been declared stable.
   Link-local, loopback, multicast, unspecified, and duplicate addresses are
   not identity candidates.
5. **Unique full system name.** Use a normalized FQDN/system name only when it
   is non-sentinel and unique in the authoritative scope. A display label or
   short hostname is not automatically an identity.
6. **Observation-scoped placeholder.** If no stronger candidate exists, create
   a deterministic placeholder from the source batch, observing device,
   observing port, and all available remote raw identifiers.

This hierarchy deliberately places typed chassis IDs first while preventing
the current untyped, lossy legacy value from overriding authoritative
inventory without verification.

### Device key format

Keys use explicit namespaces; components are UTF-8 and percent-encoded so
delimiters cannot create ambiguous keys. Examples:

```text
device:chassis:mac_address:020000000001
device:inventory:maas:system_id:abc123
device:management:ipv4:192.0.2.10
device:name:dns:leaf-01.example.test
device:placeholder:<deterministic-uuid>
```

MAC key material uses 12 lowercase hexadecimal digits without punctuation.
IP keys use canonical `ipaddress` text. Placeholder UUIDs MUST be UUIDv5 values
generated from a project-owned constant namespace and a canonical JSON array
of evidence fields. Random UUIDs and database row IDs are forbidden.

If a stronger identity is discovered later, the pipeline MUST record an
`IdentityAlias` from the old ID to the new ID. A persistent identity registry
SHOULD preserve previously published IDs when evidence quality changes. A
stateless run may deterministically re-key the device, but it must emit the
alias/rekey in its report.

### Identity conflicts

- One chassis ID with multiple names: retain all names; select the best display
  name by authority/freshness without re-keying.
- One chassis ID with multiple management addresses: retain the deduplicated
  address set; addresses do not create extra devices.
- One name with multiple chassis IDs: create separate devices and emit a
  `duplicate_name` anomaly.
- One management address with multiple chassis IDs: do not merge; emit an
  `address_identity_conflict` anomaly.
- Multiple chassis IDs for one authoritative inventory ID: retain identifiers
  as aliases only when inventory explicitly declares one logical device;
  otherwise emit `inventory_chassis_conflict`.
- Placeholder evidence that later matches a device: redirect through an alias;
  do not leave two final devices.

## Normalization rules

Normalization produces comparison keys. Raw values remain unchanged in
evidence records.

### Common string handling

1. Preserve `raw_value` exactly as decoded by the collector.
2. Normalize comparison text to Unicode NFKC.
3. Remove leading/trailing whitespace and reject control-only values.
4. Convert empty strings and known sentinels (`Not Advertised`, `n/a`, `none`,
   `null`, `-`, `unknown`) to null for semantic use while retaining the raw
   value.
5. Do not remove punctuation or internal whitespace unless a typed,
   documented normalizer requires it.

### Chassis IDs and MAC addresses

- `mac_address`: remove `:`, `-`, and `.` separators, validate exactly 12 hex
  digits, lowercase, and render display form as colon-separated octets.
- `network_address`: parse according to the address-family subtype and use
  canonical IP text.
- `interface_name`, `interface_alias`, `chassis_component`, and
  `locally_assigned`: NFKC + trim; case-fold only when the vendor/source
  contract declares the identifier case-insensitive.
- `unknown`: NFKC + trim only. Do not reinterpret or strip MAC-like text.

The current `normalize_mac()` result may be retained as a legacy alias, but it
does not recover the missing LLDP subtype.

### Hostnames and system names

- Apply NFKC, trim, lowercase, IDNA normalization, and remove one trailing dot.
- Preserve the complete FQDN for identity.
- Do **not** strip a DNS suffix by default.
- A short first-label alias MAY be generated for search/display only after
  uniqueness is checked; it is never automatically the device key.
- Sentinel names and names attached to `unresolved-*` placeholders are not
  identity candidates.

### Management addresses

- Parse with a standards-compliant IPv4/IPv6 parser and use compressed
  canonical text.
- Store address family and, for IPv6 link-local addresses, zone/scope
  separately from the address.
- Deduplicate by `(family, canonical_address, scope)` and sort deterministically.
- Preserve all valid addresses as attributes, but exclude unspecified,
  loopback, multicast, and link-local addresses from global identity fallback.
- A scalar, space-delimited CSV value and a JSON-encoded list must both become
  the same canonical array representation.
- Invalid values are preserved in evidence and emitted as anomalies.

### Capabilities

- Convert bitsets, `{type, enabled}` objects, strings, and serialized JSON lists
  into a sorted, deduplicated lowercase enum list.
- Preserve both advertised and enabled states when raw collectors provide them.
- Role derivation is an annotation, not identity, and must carry the rule
  version that produced it.

### Empty values

- Canonical optional scalar: `null`.
- Canonical collection: empty array/object, never a serialized JSON string.
- Source-level distinctions among absent, null, empty, and sentinel values are
  retained in evidence/anomaly metadata when diagnostically useful.

## Interface semantics

An Interface is an endpoint owned by exactly one Device. Physical ports, LAGs,
bonds, VLAN subinterfaces, loopbacks, and bridges remain distinct kinds.

```text
Interface
  id: InterfaceId
  device_id: DeviceId
  kind: physical | lag | bond | vlan | bridge | loopback | virtual | unknown
  port_id: PortIdentifier
  aliases: PortIdentifier[]
  parent_interface_id: InterfaceId | null
  member_interface_ids: InterfaceId[]
  mac_addresses: string[]
  description: string | null
  operational: object
  vlan: object
  source_refs: SourceRef[]
```

### Port identifier and subtype

```text
PortIdentifier
  subtype: interface_alias | port_component | mac_address |
           network_address | interface_name | agent_circuit_id |
           locally_assigned | unknown
  normalized_value: string
  raw_value: string
  vendor_namespace: string | null
  faceplate: string | null
  lane: string | null
```

### Port normalization

Base normalization is conservative:

1. retain the LLDP port-ID subtype;
2. apply common string handling;
3. preserve breakout lanes such as `:1` and `:2` as distinct identity;
4. when subtype is `mac_address`, use MAC normalization and never apply a
   breakout suffix regex;
5. do not map SONiC flat indexes, Cumulus `swp` names, Dell slot/port names, or
   Pica8 names across vendors without a versioned vendor port model;
6. vendor-aware aliases MAY equate `Eth 1/1/21:1` and
   `ethernet1/1/21:1`, but the transformation and vendor must be recorded;
7. faceplate and lane may be derived for grouping, but full port identity keeps
   both.

The existing `normalize_port()` value (`local_port_key`/`remote_port_key`) is a
search alias only. It MUST NOT be used as canonical InterfaceId because it
collapses breakout lanes and can truncate MAC-like port identifiers.

### Interface key

```text
interfaceKey = [deviceId, portSubtype, normalizedPortValue]
```

The tuple is canonical-JSON encoded for comparison. The public InterfaceId is
a deterministic UUIDv5 or an escaped namespaced form derived from that tuple.
If the port ID is absent, no ordinary canonical Interface is fabricated. The
observation carries an unknown endpoint marker and remains lower confidence.

LAG/bond identity is separate from member-port identity. An LLDP observation
to a LAG is not expanded into member links without explicit membership and
collector evidence.

## Source and observation semantics

### Source batch

```text
SourceBatch
  id: string
  collector: string
  collector_version: string | null
  source_uri: string | null
  collected_at: UTC timestamp | null
  content_digest: string | null
```

Batch IDs must be stable for the same source artifact. For legacy exports with
no timestamp, use dataset identity plus a content digest; do not invent a
collection time.

### Directed observation

```text
DirectedObservation
  id: ObservationInstanceId
  directed_key: DirectedObservationKey
  local: EndpointRef
  remote: EndpointRef
  observed_at: UTC timestamp | null
  ttl_seconds: integer | null
  collector: string
  collected_from: string | null
  source_batch_id: string
  source_record_ref: string
  attributes:
    system_name: string | null
    system_description: string | null
    management_addresses: ManagementAddress[]
    capabilities: string[]
    mau_type: string | null
    speed_mbps: integer | null
    vlan: object
    autoneg: object
  raw: object | RawReference
  validation_status: valid | partial | malformed | rejected
```

`EndpointRef` contains `device_id`, `interface_id` when known, the typed raw
chassis/port identifiers, and a `resolution_status`. Local and remote are not
interchangeable: local is the reporting side of the LLDP observation.

### Observation keys

Two keys serve different purposes:

```text
observationInstanceKey =
  [sourceBatchId, collector, sourceRecordRef]

directedObservationKey =
  [localDeviceId, localInterfaceId-or-null,
   remoteDeviceId, remoteInterfaceId-or-null]
```

- `ObservationInstanceId` is a deterministic UUIDv5 of the first tuple and
  identifies one source assertion.
- `DirectedObservationKey` groups semantically duplicate assertions while
  preserving every instance as evidence.
- Null port values are explicit null tuple members, not empty strings.
- Two observations with unknown ports are candidates for duplicate analysis,
  not proof of one physical link.
- Collector and timestamp are not part of the semantic directed key; they
  remain on each evidence instance so recurrence and freshness are preserved.

## Adjacency semantics

An Adjacency represents one reconciled, undirected network relationship
between two typed endpoints.

```text
Adjacency
  id: AdjacencyId
  undirected_key: UndirectedLinkKey
  endpoint_a: EndpointRef
  endpoint_b: EndpointRef
  kind: physical | lag | logical | lldp_adjacency | unknown
  directionality: bidirectional | one_way | conflicting
  confidence: high | medium | low
  evidence_observation_ids: ObservationInstanceId[]
  first_observed_at: UTC timestamp | null
  last_observed_at: UTC timestamp | null
  ttl_expires_at: UTC timestamp | null
  attributes: object
  warnings: string[]
```

LLDP alone proves an adjacency, not necessarily a dedicated physical cable.
Use `lldp_adjacency` unless interface type, LAG membership, and collector
evidence justify `physical`, `lag`, or `logical`.

### Undirected link key

Define a fully resolved endpoint key as:

```text
endpointKey = [deviceId, interfaceId]
```

Then:

```text
undirectedLinkKey = sort_lexicographically([endpointKeyA, endpointKeyB])
```

The key is a canonical JSON array, not delimiter-concatenated text. The public
AdjacencyId is a deterministic UUIDv5 of this tuple.

If either interface is unknown, the pipeline MUST NOT claim a port-resolved
physical adjacency. It may emit a low-confidence device-level adjacency only
when policy explicitly permits it. Such a key uses
`[deviceId, null, "device-level"]` and never merges with a port-resolved key.
Multiple non-identical unknown-port observations between the same devices stay
ambiguous rather than collapsing into one presumed cable.

## Deduplication and reconciliation baseline

These rules define canonical semantics; detailed conflict-selection policy is
expanded in Step 9.

1. **Exact source duplicates:** collapse identical observation instances into
   one stored instance with `duplicate_count` and all source row references.
2. **Directed duplicates:** observations with the same
   `DirectedObservationKey` are grouped, but raw evidence remains individually
   addressable. Compatible attributes may be summarized; conflicts produce an
   anomaly.
3. **Opposite directions:** A→B and B→A form one bidirectional Adjacency only
   when device and interface endpoint keys reverse-match. `confirmed_by` is
   supporting legacy evidence, not a substitute for retained observations.
4. **One-way evidence:** a valid single direction produces a `one_way`
   adjacency with reduced confidence. It is never silently discarded.
5. **Parallel links:** distinct endpoint pairs produce distinct adjacency IDs,
   even for the same two devices or LAG.
6. **Breakout lanes:** distinct lanes remain parallel links unless an explicit
   LAG/bundle model groups them. Faceplate aliases do not deduplicate lanes.
7. **Missing ports:** unknown-port evidence does not merge with port-specific
   evidence. Multiple ambiguous records require exact-duplicate or explicit
   reconciliation evidence before materialization.
8. **Conflicting ports:** opposite directions that identify incompatible ports
   are retained as observations, marked `conflicting`, and not forcibly merged.
9. **Self-links:** observations whose resolved local and remote DeviceId match
   are retained and reported as `self_adjacency`. They are not emitted as a
   normal adjacency unless an explicit stack/internal-loop policy approves
   them.
10. **Malformed records:** retain a source reference and anomaly; do not create
    canonical devices/interfaces from parser headings, separators, loopback
    artifacts, or nullish identity text.

### Parallel versus duplicate example

```text
A:ethernet1/1/1  <-> B:swp1   => adjacency-1
A:ethernet1/1/2  <-> B:swp2   => adjacency-2 (parallel, preserve)
A:ethernet1/1/1  ->  B:swp1   => evidence for adjacency-1
B:swp1           ->  A:ethernet1/1/1 => reverse evidence for adjacency-1
```

VLAN membership, MAU type, speed, or collection source does not by itself
create another physical adjacency when endpoint keys are identical. Those are
attributes/evidence unless policy identifies a separate logical relationship.

## Placeholder and remote-only devices

A remote system observed through LLDP but never collected locally is still a
Device with `resolution_status: provisional` when it has a usable chassis ID.
It is not a placeholder merely because evidence is one-way.

Use `placeholder` only when no usable stable identity exists. Placeholder
rules are:

- scope the ID to deterministic source and endpoint evidence;
- retain all remote raw values;
- prohibit placeholder IDs from being identity evidence for another record;
- attempt aliasing to a resolved device when stronger evidence appears;
- allow canonical storage and anomaly reporting;
- exclude from production D3 output only when the adapter's approved policy
  requires resolved devices. Do not silently drop it in the canonical layer.

The legacy prefix `unresolved-*` is input evidence, not proof that two records
refer to the same placeholder. It must not be accepted as a final DeviceId.

## Freshness semantics

When raw collectors provide time and TTL:

- normalize timestamps to timezone-aware UTC;
- reject negative TTL; preserve zero as immediate expiry;
- compute expiry from the individual observation, not the adjacency creation
  time;
- derive adjacency first/last observed times from active evidence;
- never replace newer evidence with older data solely because file order differs.

For current legacy exports, `observed_at`, TTL, and expiry remain null.
Consumers MUST report freshness as `unknown`; file modification time and an
embedded description timestamp are not acceptable substitutes.

## Classification and placement

Canonical `role` is a coarse device classification based on evidence. It does
not determine D3 ring placement by itself.

Pod, spine, leaf, rack, server, data/management plane, trust tier, failure
domain, and availability zone are optional placement/classification attributes
from authoritative inventory or explicit policy. LLDP neighbor position or
hostname patterns MAY suggest classifications but must be marked inferred and
versioned.

The canonical model does not invent rack or pod container devices merely to
satisfy a visualization ring.

## D3 adapter boundary

The adapter described by the next mapping stage converts canonical topology to
`d3-topology-contract.md`. It MUST follow these boundaries:

1. Only Devices become D3 nodes. Interfaces stay link metadata.
2. D3 `node.id` derives from stable DeviceId; `label` derives from the selected
   display name with DeviceId fallback.
3. Ring, plane, role, weight, and tooltip fields are adapter classifications,
   not identity fields.
4. D3 links use string DeviceIds and carry canonical adjacency/interface IDs in
   metadata when the target schema permits.
5. The current D3 renderer keys links only by ordered device pair and cannot
   independently interact with parallel links. The adapter must aggregate,
   filter, or select them by an explicit documented view policy while retaining
   every canonical adjacency outside the D3 payload.
6. Placeholder, conflicted, self, and device-level unknown-port adjacencies are
   included or quarantined by explicit adapter policy and reported in counts.
7. Unsupported ring placement is reported; the adapter must not assign a
   plausible-looking ring from identity alone.

The canonical model therefore remains lossless even when a particular D3 view
is intentionally aggregated.

## Determinism and ordering

- Normalize before key generation.
- Use canonical JSON arrays for composite key material.
- Use a constant UUIDv5 namespace for generated public IDs.
- Sort devices by DeviceId, interfaces by InterfaceId, observations by
  ObservationInstanceId, adjacencies by AdjacencyId, aliases by old/new ID,
  and anomalies by stable anomaly key.
- Sort set-like values such as capabilities, aliases, addresses, evidence IDs,
  and VLAN IDs by canonical value.
- Preserve source order only as explicit `source_record_ref`; never use it as a
  final tie-breaker.
- Serialize with stable key ordering and numeric/string representations.
- Do not place run timestamps, random IDs, database row order, or filesystem
  paths into content-derived keys.

## Canonical invariants

A valid canonical topology satisfies all of the following:

1. Every DeviceId is non-empty, globally unique, namespaced, and deterministic.
2. Every Interface references exactly one existing Device.
3. Every ordinary Interface key includes a typed, non-empty port identifier.
4. Raw identity and port values remain traceable from normalized values.
5. Every observation has a source batch, source record reference, collector,
   and explicit local/remote direction.
6. Every observation endpoint references a Device or carries unresolved raw
   evidence and explicit resolution status.
7. Every adjacency endpoint resolves to an existing Device and, for a
   port-resolved adjacency, an existing Interface owned by that Device.
8. Every adjacency references at least one retained observation.
9. Reversing adjacency endpoints does not change its undirected key or ID.
10. Parallel endpoint pairs remain distinct; exact duplicates do not multiply
    topology links.
11. Missing timestamps/TTL remain null and freshness remains unknown.
12. Every rejection, conflict, lossy legacy collision, and policy exclusion is
    counted and represented by an anomaly or report entry.
13. Repeated runs over equivalent evidence produce byte-equivalent canonical
    content after deterministic serialization.

## Deferred reconciliation policy details

Step 9 will expand, without changing these core identities:

- time-window and TTL rules for pairing observations;
- conflict selection when opposite directions disagree;
- virtual-chassis/member merge approval;
- LAG member versus logical-bundle presentation;
- multiple management-address preference;
- hostname change/history policy;
- cross-collection precedence and newest-record selection;
- approved placeholder and self-link behavior per output view.

## Evidence references

- D3 runtime constraints: `d3-topology-contract.md`
- Available source fields and quality limits:
  `lldp-data/lldp-source-catalog.md`
- Existing lossy normalization: `lldp-data/scripts/normalize.py`
- Normalized storage schema: `lldp-data/scripts/schema.py`
- Representative records: `lldp-data/data/fixtures/normalized-topology.json`
- Collision and malformed cases:
  `lldp-data/data/fixtures/normalized-anomalies.ndjson`
