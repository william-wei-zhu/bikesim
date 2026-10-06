"""bikesim-data build <city> --pbf <state extract> [--out DIR]

Cities live in cities.toml. Get a state extract from Geofabrik, e.g.
https://download.geofabrik.de/north-america/us/washington-latest.osm.pbf
"""

from __future__ import annotations

import argparse
import json
import tomllib
from pathlib import Path

import shutil

from .binary import write_network_bin
from .build import City, build, write_street_tiles

ROOT = Path(__file__).resolve().parents[2]


def load_cities(path: Path = ROOT / "cities.toml") -> dict[str, City]:
    raw = tomllib.loads(path.read_text())
    return {slug: City(slug=slug, name=c["name"], box=tuple(c["box"]), default_mph=c["default_mph"], arterial_mph=c.get("arterial_mph"),
                       pbf=c.get("pbf", ""), overrides=c.get("overrides", [])) for slug, c in raw["city"].items()}


def convert(src: Path, out: Path) -> None:
    net = json.loads((src / "network.json").read_text())
    out.mkdir(parents=True, exist_ok=True)
    n = write_network_bin(out / "network.bin", net["nodes"]["lon"], net["nodes"]["lat"], net["edges"], net["names"], net["src"])
    write_street_tiles(out, net["edges"])
    for f in ("blocks.json", "pois.json", "meta.json"):
        if (src / f).exists():
            shutil.copy(src / f, out / f)
    print(f"network.bin {n:,} bytes, {len(net['edges']):,} edges -> {out}")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="bikesim-data")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build one city's data files")
    b.add_argument("city")
    b.add_argument("--pbf", required=True, type=Path, help="OSM extract (.osm.pbf or .osm) covering the city")
    b.add_argument("--out", type=Path, help="output folder (default: out/<city>)")
    b.add_argument("--snapshot", default="", help="label for the OSM snapshot, e.g. geofabrik 2026-10-05")
    b.add_argument("--legacy-json", action="store_true", help="also write network.json (DC's Ride it page reads it)")
    sub.add_parser("list", help="list configured cities")
    cv = sub.add_parser("convert", help="turn an existing network.json folder (DC's RideScore build) into network.bin + streets.pmtiles")
    cv.add_argument("src", type=Path)
    cv.add_argument("out", type=Path)
    a = ap.parse_args(argv)
    cities = load_cities()
    if a.cmd == "list":
        for c in cities.values():
            print(f"{c.slug:15} {c.name:20} default {c.default_mph} mph  extract: {c.pbf}")
        return
    if a.cmd == "convert":
        convert(a.src, a.out)
        return
    city = cities[a.city]
    meta = build(city, a.pbf, a.out or ROOT / "out" / city.slug, a.snapshot, a.legacy_json)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
