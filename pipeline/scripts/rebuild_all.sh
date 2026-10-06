#!/bin/sh
# Rebuild every OSM city from its clipped extract with the current code, then convert DC.
#   scripts/rebuild_all.sh <clip date>      e.g. scripts/rebuild_all.sh 2026-10-05
set -eu
d=$1
for c in $(uv run bikesim-data list | awk '{print $1}' | grep -v '^dc$'); do
  uv run bikesim-data build "$c" --pbf "../../osm/clips/$c-$d.osm.pbf" --snapshot "Geofabrik $d" > "out/$c.build.log"
  python3 -c "import json; m=json.load(open('out/$c/meta.json')); print('$c', m['edges'], m.get('official_ways', 0), m['share_by_lts'])"
done
uv run bikesim-data convert ../public/data/dc out/dc
