#!/bin/sh
# Upload one built city to the public data bucket under its build date, and archive a copy.
#   scripts/publish.sh <slug> <date>      e.g. scripts/publish.sh seattle 2026-10-05
# network.bin and the JSON files are stored gzip-encoded; streets.pmtiles is stored as-is
# (MapLibre reads it with range requests, which gzip encoding would break).
set -eu
slug=$1; ver=$2; src=out/$slug; dst=gs://bikesim-data/$slug/$ver
cache="Cache-Control:public, max-age=31536000, immutable"
gcloud storage cp --gzip-local-all --cache-control="public, max-age=31536000, immutable" "$src"/network.bin "$src"/*.json "$dst"/
gcloud storage cp --cache-control="public, max-age=31536000, immutable" --content-type=application/vnd.pmtiles "$src"/streets.pmtiles "$dst"/
gcloud storage rsync -r "$src" gs://bikesim-archive/builds/$slug/$ver
echo "published $dst"
