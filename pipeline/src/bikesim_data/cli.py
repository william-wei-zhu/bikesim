"""bikesim-data build <city> --pbf <state extract> [--out DIR]

Cities live in cities.toml. Get a state extract from Geofabrik, e.g.
https://download.geofabrik.de/north-america/us/washington-latest.osm.pbf
"""

from __future__ import annotations

import argparse
import json
import tomllib
from pathlib import Path

from .build import City, build

ROOT = Path(__file__).resolve().parents[2]


def load_cities(path: Path = ROOT / "cities.toml") -> dict[str, City]:
    raw = tomllib.loads(path.read_text())
    return {slug: City(slug=slug, name=c["name"], box=tuple(c["box"]), default_mph=c["default_mph"],
                       pbf=c.get("pbf", ""), overrides=c.get("overrides", [])) for slug, c in raw["city"].items()}


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="bikesim-data")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build one city's data files")
    b.add_argument("city")
    b.add_argument("--pbf", required=True, type=Path, help="OSM extract (.osm.pbf or .osm) covering the city")
    b.add_argument("--out", type=Path, help="output folder (default: out/<city>)")
    b.add_argument("--snapshot", default="", help="label for the OSM snapshot, e.g. geofabrik 2026-10-05")
    sub.add_parser("list", help="list configured cities")
    a = ap.parse_args(argv)
    cities = load_cities()
    if a.cmd == "list":
        for c in cities.values():
            print(f"{c.slug:15} {c.name:20} default {c.default_mph} mph  extract: {c.pbf}")
        return
    city = cities[a.city]
    meta = build(city, a.pbf, a.out or ROOT / "out" / city.slug, a.snapshot)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
