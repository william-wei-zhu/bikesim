"""Official LTS layers that replace the OSM estimate where a city publishes one.

Two kinds of layer, one spec each in cities.toml (`overrides = [...]`):

    keyed by OSM way id   { name, path, way_id = "<field>", lts = "<field>" }      Cook County (Chicago)
    on the city's own     { name, path, lts = "<field>", join = "spatial" }        Boston BLTS, DVRPC
    centerlines

A spatial layer is matched to OSM ways geometrically (`Overrides.join`): every ~10 m piece of an
OSM road looks for an official segment within MAX_GAP_M whose bearing is within MAX_TURN_DEG
(undirected), takes the nearest, and the way gets the LTS of the official segment it overlaps most,
but only when matched pieces cover at least MIN_COVER of the way. Only roads are joined: a
separated cycleway or trail drawn beside an arterial would otherwise inherit the arterial's LTS 4.
A way-id match beats a spatial one; among spatial layers the first listed wins.

Relative paths resolve against the pipeline folder; a missing file is a warning, not a failure.
"""

from __future__ import annotations

import csv
import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

MAX_GAP_M = 12.0     # how far an official centerline may sit from the OSM way
MAX_TURN_DEG = 20.0  # how far apart their bearings may be (undirected)
MIN_COVER = 0.5      # share of the OSM way's length that must match before it is overridden
PIECE_M = 10.0       # OSM ways are sampled in pieces this long


def _lts(v) -> int | None:
    # LTS may arrive as 3, 3.0 or "LTS 3"; 0 / NULL (Boston: no bike access) is no score.
    m = re.search(r"\d", str(v)) if v is not None else None
    n = int(m.group()) if m else 0
    return n if 1 <= n <= 4 else None


def _lines(geom: dict | None) -> list[list]:
    if not geom:
        return []
    return [geom["coordinates"]] if geom["type"] == "LineString" else geom["coordinates"] if geom["type"] == "MultiLineString" else []


@dataclass
class _Layer:
    """One spatial layer, cut into straight 2-point segments for the tree."""

    name: str
    seg: list[tuple[float, float, float, float]] = field(default_factory=list)  # lon/lat pairs
    feat: list[int] = field(default_factory=list)  # which official feature each segment came from
    lts: list[int] = field(default_factory=list)   # per feature


@dataclass
class Overrides:
    by_way: dict[int, int] = field(default_factory=dict)
    sources: list[str] = field(default_factory=list)
    spatial: list[_Layer] = field(default_factory=list)
    joined: dict[int, int] = field(default_factory=dict)

    @classmethod
    def load(cls, specs: list[dict]) -> "Overrides":
        o = cls()
        for spec in specs:
            path = Path(spec["path"])
            if not path.is_absolute():
                path = Path(__file__).resolve().parents[2] / path
            name = spec.get("name", path.name)
            if not path.exists():
                print(f"warning: official layer {name} not found at {path}; using the OSM estimate")
                o.sources.append(f"{name}: not loaded")
                continue
            lts_col = spec.get("lts", "lts")
            rows = (json.loads(path.read_text())["features"] if path.suffix in {".json", ".geojson"}
                    else list(csv.DictReader(path.open())))
            if spec.get("join") == "spatial":
                layer = _Layer(name)
                for r in rows:
                    lts = _lts(r["properties"].get(lts_col))
                    if lts is None:
                        continue
                    for line in _lines(r.get("geometry")):
                        for (x1, y1, *_), (x2, y2, *_) in zip(line, line[1:]):
                            layer.seg.append((x1, y1, x2, y2))
                            layer.feat.append(len(layer.lts))
                    layer.lts.append(lts)
                o.spatial.append(layer)
                o.sources.append(f"{name}: {len(layer.lts)} segments (spatial join pending)")
                continue
            id_col, n = spec.get("way_id", "way_id"), 0
            for r in rows:
                props = r.get("properties", r)
                try:
                    way, lts = int(float(props[id_col])), _lts(props[lts_col])
                except (KeyError, TypeError, ValueError):
                    continue
                if lts:
                    o.by_way[way] = lts
                    n += 1
            o.sources.append(f"{name}: {n} ways")
        return o

    def join(self, ways: dict[int, list[tuple[float, float]]]) -> None:
        """Match spatial layers to OSM ways ({way id: [(lon, lat), ...]}); no-op without one."""
        for k, layer in enumerate(self.spatial):
            todo = {w: c for w, c in ways.items() if w not in self.by_way and w not in self.joined}
            got = spatial_join(layer, todo)
            self.joined.update(got)
            ix = next(i for i, s in enumerate(self.sources) if s.startswith(f"{layer.name}: ") and "pending" in s)
            self.sources[ix] = f"{layer.name}: {len(got)} of {len(todo)} OSM roads matched ({len(layer.lts)} segments)"

    def get(self, way_id: int) -> int | None:
        v = self.by_way.get(way_id)
        return v if v is not None else self.joined.get(way_id)

    def describe(self) -> list[str]:
        return self.sources


def spatial_join(layer: _Layer, ways: dict[int, list[tuple[float, float]]]) -> dict[int, int]:
    """{way id: official LTS} for the ways the layer covers (see the module docstring)."""
    import numpy as np
    import shapely

    if not layer.seg or not ways:
        return {}
    seg = np.asarray(layer.seg, dtype=float)
    # Local equirectangular metres around the layer's centre (same scale as build.metres).
    lon0, lat0 = seg[:, 0].mean(), seg[:, 1].mean()
    kx, ky = 111_320 * math.cos(math.radians(lat0)), 110_540

    def xy(lon, lat):
        return (np.asarray(lon) - lon0) * kx, (np.asarray(lat) - lat0) * ky

    ax, ay = xy(seg[:, 0], seg[:, 1])
    bx, by = xy(seg[:, 2], seg[:, 3])
    tree = shapely.STRtree(shapely.linestrings(np.stack([np.stack([ax, ay], 1), np.stack([bx, by], 1)], 1)))
    seg_dir = np.degrees(np.arctan2(by - ay, bx - ax)) % 180
    seg_feat, feat_lts = np.asarray(layer.feat), np.asarray(layer.lts)

    # Cut every way into pieces of <= PIECE_M; each piece is its midpoint, length and bearing.
    pw, px, py, pl, pd = [], [], [], [], []
    for w, coords in ways.items():
        if len(coords) < 2:
            continue
        x, y = xy([c[0] for c in coords], [c[1] for c in coords])
        for i in range(len(x) - 1):
            dx, dy = x[i + 1] - x[i], y[i + 1] - y[i]
            d = math.hypot(dx, dy)
            if d == 0:
                continue
            n = max(1, math.ceil(d / PIECE_M))
            t = (np.arange(n) + 0.5) / n
            pw += [w] * n
            px += list(x[i] + dx * t)
            py += list(y[i] + dy * t)
            pl += [d / n] * n
            pd += [math.degrees(math.atan2(dy, dx)) % 180] * n
    if not pw:
        return {}
    pw, pl, pd = np.asarray(pw), np.asarray(pl), np.asarray(pd)
    pts = shapely.points(px, py)

    # Candidate pairs within MAX_GAP_M, kept if the bearings agree; each piece takes the nearest.
    pi, si = tree.query(pts, predicate="dwithin", distance=MAX_GAP_M)
    turn = np.abs(pd[pi] - seg_dir[si])
    ok = np.minimum(turn, 180 - turn) < MAX_TURN_DEG
    pi, si = pi[ok], si[ok]
    dist = shapely.distance(pts[pi], tree.geometries[si])
    order = np.lexsort((dist, pi))
    pi, si = pi[order], si[order]
    first = np.r_[True, pi[1:] != pi[:-1]]
    pi, si = pi[first], si[first]

    total: dict[int, float] = defaultdict(float)
    for w, l in zip(pw, pl):
        total[int(w)] += l
    per: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for p, f in zip(pi, seg_feat[si]):
        per[int(pw[p])][int(f)] += pl[p]
    out = {}
    for w, by_feat in per.items():
        if sum(by_feat.values()) >= MIN_COVER * total[w]:
            # The official feature with the most overlap; on a tie, the more stressful one.
            f = max(by_feat, key=lambda f: (round(by_feat[f], 3), feat_lts[f]))
            out[w] = int(feat_lts[f])
    return out
