"""Build every city in cities.toml: download the state extract once, clip it to each city's box
(padded 2 km), build, then delete the state file. Clipped extracts are kept in OSM_DIR/clips for
the archive bucket.

    uv run python scripts/build_all.py [slug ...]
"""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bikesim_data.build import build  # noqa: E402
from bikesim_data.cli import ROOT, load_cities  # noqa: E402

OSM_DIR = ROOT.parents[1] / "osm"
CLIPS = OSM_DIR / "clips"


def main(only: list[str]) -> None:
    cities = {k: c for k, c in load_cities().items() if k != "dc" and (not only or k in only)}
    by_pbf: dict[str, list] = {}
    for c in cities.values():
        by_pbf.setdefault(c.pbf, []).append(c)
    CLIPS.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    for url, group in by_pbf.items():
        state = OSM_DIR / url.rsplit("/", 1)[1]
        need = [c for c in group if not (CLIPS / f"{c.slug}-{today}.osm.pbf").exists()]
        if need and not state.exists():
            print(f"download {url}", flush=True)
            urllib.request.urlretrieve(url, state)
        for c in group:
            clip = CLIPS / f"{c.slug}-{today}.osm.pbf"
            if not clip.exists():
                w, s, e, n = c.box
                bbox = f"{w - 0.03},{s - 0.02},{e + 0.03},{n + 0.02}"
                subprocess.run(["osmium", "extract", "-b", bbox, "-s", "complete_ways", "-O", "-o", str(clip), str(state)], check=True)
            meta = build(c, clip, ROOT / "out" / c.slug, f"Geofabrik {url.rsplit('/', 1)[1]} {today}")
            print(json.dumps({k: meta[k] for k in ("city", "edges", "share_by_lts", "network_bin_bytes")}), flush=True)
        if state.exists():
            state.unlink()


if __name__ == "__main__":
    main(sys.argv[1:])
