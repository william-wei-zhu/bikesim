"""Compare an OSM-built city against a reference network in the same schema (DC: RideScore DC).

Edges are matched on their two end coordinates (rounded to ~1 m), which works because both
networks are split at OSM nodes. Prints km by LTS for each side and a km-weighted confusion matrix.
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def _edges(path: Path, only_src: set[str] | None = None):
    net = json.loads(path.read_text())
    lon, lat, src = net["nodes"]["lon"], net["nodes"]["lat"], net["src"]
    for u, v, length, lts, s, name, block, coords in net["edges"]:
        if only_src and src[s] not in only_src:
            continue
        a, b = (round(lon[u], 5), round(lat[u], 5)), (round(lon[v], 5), round(lat[v], 5))
        yield tuple(sorted([a, b])), length, lts, net["names"][name]


def compare(ours: Path, ref: Path, ref_src: set[str] | None = None) -> dict:
    mine = {k: (ln, lts, nm) for k, ln, lts, nm in _edges(ours)}
    km_ref, km_ours, conf = Counter(), Counter(), defaultdict(float)
    examples: dict[tuple[int, int], Counter] = defaultdict(Counter)
    matched = total = 0.0
    for k, ln, lts, nm in _edges(ref, ref_src):
        total += ln
        km_ref[lts] += ln / 1000
        if k in mine:
            matched += ln
            o = mine[k][1]
            km_ours[o] += ln / 1000
            conf[(lts, o)] += ln / 1000
            examples[(lts, o)][nm] += ln
    return {"matched_share": matched / total, "km_ref": km_ref, "km_ours": km_ours, "conf": conf, "examples": examples}


def main() -> None:
    ours, ref = Path(sys.argv[1]), Path(sys.argv[2])
    r = compare(ours, ref, {"ridescore_v1"})
    print(f"matched {r['matched_share']:.0%} of reference km")
    tot = sum(r["km_ours"].values())
    for k in range(1, 5):
        print(f"LTS {k}: ref {r['km_ref'][k]:7.1f} km   ours (matched) {r['km_ours'][k]:7.1f} km  {r['km_ours'][k] / tot:5.1%}")
    print("rows = RideScore, cols = ours (km)")
    for a in range(1, 5):
        print(a, " ".join(f"{r['conf'][(a, b)]:8.1f}" for b in range(1, 5)))
    agree = sum(r["conf"][(a, a)] for a in range(1, 5)) / tot
    within1 = sum(v for (a, b), v in r["conf"].items() if abs(a - b) <= 1) / tot
    print(f"exact agreement {agree:.0%}, within one level {within1:.0%}")
    for key in [(4, 1), (4, 2), (1, 4), (3, 1)]:
        top = ", ".join(f"{n or '(unnamed)'}" for n, _ in r["examples"][key].most_common(6))
        print(f"RideScore {key[0]} vs ours {key[1]}: {top}")


if __name__ == "__main__":
    main()
