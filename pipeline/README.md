# bikesim-data

Builds the street data for [BikeSim](https://bikesim.org) cities: every bikeable street in a city,
split into blocks, each scored with a Level of Traffic Stress (LTS, 1 calm to 4 hostile).
Output is published to the public bucket `gs://bikesim-data/<city>/<build date>/`, which the app reads.

> Lives in the BikeSim app repo under `pipeline/` for now; it is self-contained and meant to move to
> its own `bikesim-data` repo.

## Run

```bash
uv sync && uv run pytest
uv run bikesim-data list                                  # cities, defaults and extract URLs (cities.toml)
uv run python scripts/build_all.py [slug ...]             # download each state extract once, clip to the city, build, delete
scripts/rebuild_all.sh 2026-10-05                         # rebuild every city from its kept clip (../../osm/clips/) with current code
uv run bikesim-data convert ../public/data/dc out/dc      # DC: RideScore DC's network.json -> network.bin + streets.pmtiles
scripts/publish.sh <slug> <build date>                    # upload to gs://bikesim-data/<slug>/<date>/ and archive the build
uv run python -m bikesim_data.calibrate out/dc-osm/network.json ../public/data/dc/network.json   # OSM model vs RideScore DC
```

After publishing a new build date, set `data` for that city in `lib/cities.ts` (the bucket path is cached
as immutable, so a rebuild always gets a new date). Official layers are fetched with `scripts/fetch_arcgis.py`
(commands in `cities.toml`). Needs `osmium-tool` and `tippecanoe` (brew).

## How stress is scored

Furth, Mekuria & Nixon (2017) LTS criteria (`src/bikesim_data/lts.py`): separated paths and tracks are LTS 1;
bike lanes are scored by speed and lanes per direction (a buffer earns one level back up to 35 mph); mixed
traffic by speed, lanes and road class, with road class standing in for traffic volume (residential = quiet,
collector, arterial = busy). DC itself keeps RideScore DC's scores; on DC's streets this model agrees with
RideScore within one level on 85% of matched length. The inputs come from OpenStreetMap tags:

| Input | From OSM | When OSM is silent |
|---|---|---|
| Bike facility | `highway=cycleway`, trails with `bicycle=yes/designated`, `cycleway*=track` (protected); `cycleway*=lane` (painted, or buffered with `:buffer`/`:separation`) | none |
| Speed | `maxspeed` | the city's legal default: `default_mph` for local streets, `arterial_mph` where set, else 25 to 40 mph by class |
| Lanes | `lanes` | 1 or 2 for local streets, 2 to 4 by class |
| Road function | `highway` class (residential/unclassified/service = local) | |

Dropped before routing: motorways, sidewalks and footpaths that don't allow bikes, unnamed service roads
(parking aisles, driveways, access lanes; alleys and named or bike-tagged ones stay), private roads, and
anything not connected to the main network.

Official city layers replace the OSM estimate where they exist (`overrides` in `cities.toml`,
code in `overrides.py`). A layer keyed by OSM way id is a straight lookup; a layer on the city's own
centerlines is matched by geometry (`join = "spatial"`): each ~10 m piece of an OSM road takes the
nearest official segment within 12 m whose bearing is within 20 degrees, and the road gets the LTS of
the segment it overlaps most if at least half its length matched. Trails and cycleways are not
spatially joined (a sidepath beside an arterial would inherit the arterial's LTS 4).
Fetch layers into `sources/<city>/` (gitignored) with `scripts/fetch_arcgis.py`; the exact commands
are in `cities.toml`.

| City | Official layer | Join |
|---|---|---|
| Chicago | Cook County LTS 2023 (`gis.cookcountyil.gov` DOTH_expanded/MapServer/14; `way_id`, `lts`; 2022 edition is layer 13) | OSM way id, then spatial for ways redrawn since |
| Boston | Boston BLTS 2024 (boston.gov/blts; ArcGIS `BLTS_2024` FeatureServer; `lts`, 0 = no bike access) | spatial |
| Philadelphia | DVRPC LTS Network (catalog.dvrpc.org, `dvrpc/gis-lts-calc`; `lts`) | spatial |
| Seattle | SDOT Bicycle LTS | percentile-based, not 1-4 Furth; use as a cross-check only |

## Output

`network.bin` (the routing graph as typed arrays; layout in `src/bikesim_data/binary.py`, read by the app's
`parseNetBin`), `streets.pmtiles` (one `streets` layer with `lts`, for drawing; tippecanoe z9-15),
`network.json` only with `--legacy-json` (edges `[u, v, len_m, lts, src, name, block, coords]`),
`blocks.json` (one row per OSM way: speed, lanes, facility, class; no crash columns),
`pois.json` (schools, libraries, stations, rec centers), `meta.json` (counts, LTS shares, provenance).

## License

Output is derived from OpenStreetMap and is published under the ODbL 1.0.
© OpenStreetMap contributors.
