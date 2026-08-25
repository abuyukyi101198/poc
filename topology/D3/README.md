# D3 topology demo

Run all commands below from the repository root. The reference topology options
work without LLDP or MAAS data.

## Run the reference demo

Open `topology/D3/index.html` directly in a browser. Use the Option A-D tabs
to switch reference topologies.

No HTTP server is needed for the reference demo.

## Add LLDP fixtures

1. Create `topology/D3/data/lldp/`.
2. Copy each LLDP topology export into that directory.
3. Add `topology/D3/data/lldp/datasets.json` to list the exports:

   ```json
   [
     {
       "name": "Example data center",
       "file": "example.json"
     }
   ]
   ```

4. Generate browser fixtures:

   ```bash
   node topology/D3/scripts/generate-lldp-fixtures.mjs
   ```

The command writes `topology/D3/data/generated/lldp/`.

Serve the demo over HTTP to load generated LLDP tabs:

```bash
python3 -m http.server 8000 --directory topology/D3
```

Open <http://localhost:8000>. One LLDP tab appears for each entry in
`datasets.json`.

## Add optional MAAS enrichment

1. Place the MAAS UI scrape at:

   ```text
   topology/D3/data/lldp/tor3_maas-ui.json
   ```

2. Generate the compact enrichment artifact:

   ```bash
   node topology/D3/scripts/filter-maas-ui-enrichment.mjs
   ```

3. Regenerate the LLDP fixtures so the enrichment is joined:

   ```bash
   node topology/D3/scripts/generate-lldp-fixtures.mjs
   ```

The enrichment generator writes
`topology/D3/data/generated/maas/tor3-maas-ui-enrichment.json`. When matches
are available, the LLDP tabs expose availability-zone and operational lenses.

## Private data

`data/lldp/` and `data/generated/` are ignored by Git. Keep raw exports and
generated artifacts local; rerun the generators whenever the source data
changes.
