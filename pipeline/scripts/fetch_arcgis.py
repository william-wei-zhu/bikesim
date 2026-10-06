"""Download an ArcGIS REST feature layer as one GeoJSON file (WGS84), optionally clipped to a box.

    uv run python scripts/fetch_arcgis.py <layer url> <out.geojson> [--box W S E N] [--fields a,b]

Pages through the layer with resultOffset (servers cap a query at maxRecordCount, often 1000-2000).
The box filter is an envelope intersect on the server, so segments crossing the edge are kept whole.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def _read(q: str) -> dict:
    try:
        with urllib.request.urlopen(urllib.request.Request(q, headers={"User-Agent": "bikesim-data"}), timeout=120) as r:
            return json.load(r)
    except urllib.error.URLError as e:
        if "CERTIFICATE" not in str(e):
            raise
        # Some servers (arcgis.dvrpc.org) send an incomplete chain; the system curl resolves it.
        return json.loads(subprocess.run(["curl", "-sfL", "--max-time", "120", q], check=True, capture_output=True).stdout)


def get(url: str, params: dict) -> dict:
    q = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            d = _read(q)
            if "error" in d:
                raise RuntimeError(d["error"])
            return d
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError


def fetch(layer: str, out: Path, box: list[float] | None = None, fields: str = "*") -> int:
    layer = layer.rstrip("/")
    info = get(layer, {"f": "json"})
    page = min(int(info.get("maxRecordCount") or 1000), 2000)
    oid = next((f["name"] for f in info.get("fields", []) if f["type"] == "esriFieldTypeOID"), "OBJECTID")
    q = {"where": "1=1", "outFields": fields, "outSR": 4326, "f": "geojson", "orderByFields": oid, "returnGeometry": "true"}
    if box:
        q |= {"geometry": ",".join(map(str, box)), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
              "spatialRel": "esriSpatialRelIntersects"}
    feats, off = [], 0
    while True:
        d = get(layer + "/query", q | {"resultOffset": off, "resultRecordCount": page})
        got = d.get("features", [])
        feats += got
        off += len(got)
        print(f"\r{len(feats):,} features", end="", flush=True)
        if not got or not (d.get("exceededTransferLimit") or d.get("properties", {}).get("exceededTransferLimit")) and len(got) < page:
            break
    print()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "source": layer, "features": feats}, separators=(",", ":")))
    return len(feats)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("layer")
    ap.add_argument("out", type=Path)
    ap.add_argument("--box", type=float, nargs=4, metavar=("W", "S", "E", "N"))
    ap.add_argument("--fields", default="*")
    a = ap.parse_args()
    print(f"{fetch(a.layer, a.out, a.box, a.fields):,} features -> {a.out}")
