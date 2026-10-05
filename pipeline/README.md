# bikesim-data

Builds the street data for [BikeSim](https://bikesim.org) cities: every bikeable street in a city,
split into blocks, each scored with a Level of Traffic Stress (LTS, 1 calm to 4 hostile).
Output goes straight into the app's `public/data/<city>/` folder.

> Lives in the BikeSim app repo under `pipeline/` for now; it is self-contained and meant to move to
> its own `bikesim-data` repo.

## Run

```bash
uv sync
uv run bikesim-data list
curl -LO https://download.geofabrik.de/north-america/us/washington-latest.osm.pbf
uv run bikesim-data build seattle --pbf washington-latest.osm.pbf --snapshot "geofabrik 2026-10-05"
mkdir -p ../public/data/seattle && cp out/seattle/*.json ../public/data/seattle/   # then set live: true in lib/cities.ts
uv run pytest
```

Each city's extract URL is in `cities.toml`.

## How stress is scored

The rules table is RideScore DC's (`ridescoredc-models`, `ridescore_v1/lts.py`), unchanged, so a
block scores the same in any city as it would in DC. The inputs come from OpenStreetMap tags:

| Input | From OSM | When OSM is silent |
|---|---|---|
| Bike facility | `highway=cycleway`, trails with `bicycle=yes/designated`, `cycleway*=track` (protected); `cycleway*=lane` (painted, or buffered with `:buffer`/`:separation`) | none |
| Speed | `maxspeed` | the city's default for local streets (`default_mph`), 25 to 40 mph by class for bigger roads |
| Lanes | `lanes` | 1 or 2 for local streets, 2 to 4 by class |
| Road function | `highway` class (residential/unclassified/service = local) | |

Dropped before routing: motorways, sidewalks and footpaths that don't allow bikes, parking aisles,
driveways, private roads, and anything not connected to the main network.

Official city layers replace the OSM estimate where they exist and can be joined:

| City | Official layer | Status |
|---|---|---|
| Chicago | Cook County LTS 2022 (`gis.cookcountyil.gov` DOTH_expanded/13), keyed by OSM `way_id` | supported (export to GeoJSON into `sources/chicago/`) |
| Boston | Boston BLTS 2024 (boston.gov/blts) | needs a spatial join to OSM ways |
| Philadelphia | DVRPC LTS Network (catalog.dvrpc.org, `dvrpc/gis-lts-calc`) | needs a spatial join |
| Seattle | SDOT Bicycle LTS | percentile-based, not 1-4 Furth; use as a cross-check only |

## Output

Same schema as DC's `prep.py`, so the app needs no engine change:
`network.json` (nodes, edges `[u, v, len_m, lts, src, name, block, coords]`, names, src),
`blocks.json` (one row per OSM way: speed, lanes, facility, class; no crash columns),
`pois.json` (schools, libraries, stations, rec centers), `meta.json` (counts, LTS shares, provenance).

## License

Output is derived from OpenStreetMap and is published under the ODbL 1.0.
© OpenStreetMap contributors.
