"""OSM extract -> the four files BikeSim reads from public/data/<city>/.

network.json  {nodes: {lon, lat}, edges: [[u, v, len_m, lts, src, name, block, [lon, lat, ...]]], names, src}
blocks.json   {cols, rows}: one row per OSM way (the street facts behind "why is it hostile?")
pois.json     [{t, n, x, y, node, d}]: schools, libraries, stations, rec centers for search
meta.json     provenance and counts

Same schema as DC's prep.py output, so the app needs no engine change.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import osmium

from . import lts as L
from .overrides import Overrides

SRC = ["osm_lts", "track_rule", "trail_rule", "official"]
BLOCK_COLS = ["osm_way_id", "route_name", "function", "num_lanes", "speed_limit", "bike_facility_type", "speed_filled", "lts_level"]
FACILITY_TEXT = {"protected_track": "Protected bike lane or trail", "buffered_lane": "Buffered bike lane", "painted_lane": "Painted bike lane", "none": "No bike lane"}


@dataclass
class City:
    slug: str
    name: str
    box: tuple[float, float, float, float]  # west, south, east, north
    default_mph: int
    pbf: str = ""
    overrides: list[dict] = field(default_factory=list)


@dataclass
class Way:
    id: int
    refs: list[int]
    tags: dict[str, str]


class _Ways(osmium.SimpleHandler):
    """Pass 1: bikeable ways and POIs, with node coordinates."""

    def __init__(self, box):
        super().__init__()
        self.box = box
        self.ways: list[Way] = []
        self.loc: dict[int, tuple[float, float]] = {}
        self.pois: list[tuple[str, str, float, float]] = []

    def _inside(self, x, y):
        w, s, e, n = self.box
        return w <= x <= e and s <= y <= n

    def node(self, n):
        if n.tags and n.location.valid():
            self._poi(dict(n.tags), n.location.lon, n.location.lat)

    def way(self, w):
        tags = dict(w.tags)
        if "highway" not in tags:
            if tags.get("name") and len(w.nodes) > 2:
                pts = [(nd.lon, nd.lat) for nd in w.nodes if nd.location.valid()]
                if pts:
                    self._poi(tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            return
        if not L.usable(tags):
            return
        refs, inside = [], False
        for nd in w.nodes:
            if not nd.location.valid():
                continue
            refs.append(nd.ref)
            self.loc[nd.ref] = (nd.lon, nd.lat)
            inside = inside or self._inside(nd.lon, nd.lat)
        if inside and len(refs) > 1:
            self.ways.append(Way(w.id, refs, tags))

    def _poi(self, tags, x, y):
        if not tags.get("name") or not self._inside(x, y):
            return
        a, r, le = tags.get("amenity"), tags.get("railway"), tags.get("leisure")
        t = ("school" if a in {"school", "college", "university"} else "library" if a == "library"
             else "metro" if r in {"station", "halt"} or tags.get("public_transport") == "station"
             else "rec" if le in {"sports_centre", "park"} or a == "community_centre" else None)
        if t:
            self.pois.append((t, tags["name"], x, y))


def metres(x1, y1, x2, y2):
    k = math.cos(math.radians((y1 + y2) / 2))
    return math.hypot((x2 - x1) * 111_320 * k, (y2 - y1) * 110_540)


def build(city: City, pbf: Path, out: Path, snapshot: str = "") -> dict:
    h = _Ways(city.box)
    h.apply_file(str(pbf), locations=True)
    ov = Overrides.load(city.overrides)

    # Intersections: a node shared by two ways, or a way's end, splits blocks.
    use = Counter(r for w in h.ways for r in w.refs)
    for w in h.ways:
        use[w.refs[0]] += 2
        use[w.refs[-1]] += 2

    names: list[str] = []
    name_ix: dict[str, int] = {}
    blocks: list[list] = []
    raw_edges = []  # (u_osm, v_osm, coords, facts_lts, src, name, block)
    for w in h.ways:
        f = L.classify(w.tags, city.default_mph)
        lts, src = f.lts, SRC.index(f.rule)
        o = ov.get(w.id)
        if o is not None:
            lts, src = o, SRC.index("official")
        name = w.tags.get("name", "")
        if name not in name_ix:
            name_ix[name] = len(names)
            names.append(name)
        b = len(blocks)
        blocks.append([w.id, name, f.function.title() if f.function == "local" else f.function, f.lanes,
                       f.speed, FACILITY_TEXT[f.facility], f.speed_estimated, lts])
        start = 0
        for i in range(1, len(w.refs)):
            if i == len(w.refs) - 1 or use[w.refs[i]] > 1:
                seg = w.refs[start:i + 1]
                # A loop that closes on itself (a cul-de-sac ring) becomes two edges, not a self-loop.
                parts = [seg] if seg[0] != seg[-1] else [seg[:len(seg) // 2 + 1], seg[len(seg) // 2:]] if len(seg) > 2 else []
                for part in parts:
                    raw_edges.append((part[0], part[-1], part, lts, src, name_ix[name], b))
                start = i

    # Keep the largest connected piece: islands (a lone campus loop) can't route anywhere.
    parent: dict[int, int] = {}

    def find(a):
        while parent.setdefault(a, a) != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for u, v, *_ in raw_edges:
        parent[find(u)] = find(v)
    sizes = Counter(find(u) for u, *_ in raw_edges)
    root = sizes.most_common(1)[0][0] if sizes else None

    node_ix: dict[int, int] = {}
    lon, lat, edges = [], [], []

    def nid(r):
        if r not in node_ix:
            node_ix[r] = len(lon)
            x, y = h.loc[r]
            lon.append(round(x, 6))
            lat.append(round(y, 6))
        return node_ix[r]

    by_lts = Counter()
    for u, v, seg, lts, src, nm, b in raw_edges:
        if find(u) != root:
            continue
        pts = [h.loc[r] for r in seg]
        if not (h._inside(*pts[0]) or h._inside(*pts[-1])):
            continue  # beyond the city limits at both ends
        length = sum(metres(*pts[k - 1], *pts[k]) for k in range(1, len(pts)))
        flat = [round(c, 5) for p in pts for c in p]
        edges.append([nid(u), nid(v), round(length, 1), lts, src, nm, b, flat])
        by_lts[lts] += length

    # Nearest network node for each POI (grid lookup).
    cell = 0.004
    grid: dict[tuple[int, int], list[int]] = {}
    for i, (x, y) in enumerate(zip(lon, lat)):
        grid.setdefault((int(x // cell), int(y // cell)), []).append(i)
    pois, seen = [], set()
    for t, n, x, y in h.pois:
        if (t, n) in seen:
            continue
        cx, cy = int(x // cell), int(y // cell)
        best, bd = -1, 600.0
        for i in range(cx - 2, cx + 3):
            for j in range(cy - 2, cy + 3):
                for k in grid.get((i, j), ()):
                    d = metres(x, y, lon[k], lat[k])
                    if d < bd:
                        best, bd = k, d
        if best >= 0:
            seen.add((t, n))
            pois.append({"t": t, "n": n, "x": round(x, 5), "y": round(y, 5), "node": best, "d": round(bd)})

    out.mkdir(parents=True, exist_ok=True)
    dump = lambda name, obj: (out / name).write_text(json.dumps(obj, separators=(",", ":")))  # noqa: E731
    dump("network.json", {"nodes": {"lon": lon, "lat": lat}, "edges": edges, "names": names, "src": SRC})
    dump("blocks.json", {"cols": BLOCK_COLS, "rows": blocks})
    dump("pois.json", pois)
    total = sum(by_lts.values()) or 1
    meta = {
        "city": city.slug, "name": city.name, "built": date.today().isoformat(), "osm_snapshot": snapshot or pbf.name,
        "rules": "RideScore DC v1 LTS table on OpenStreetMap tags (bikesim_data.lts)",
        "default_mph": city.default_mph, "nodes": len(lon), "edges": len(edges), "pois": len(pois),
        "dropped_edges": len(raw_edges) - len(edges),
        "km_by_lts": {str(k): round(v / 1000, 1) for k, v in sorted(by_lts.items())},
        "share_by_lts": {str(k): round(v / total, 3) for k, v in sorted(by_lts.items())},
        "official_overrides": ov.describe(),
        "license": "Derived from OpenStreetMap (ODbL 1.0). © OpenStreetMap contributors.",
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    return meta
