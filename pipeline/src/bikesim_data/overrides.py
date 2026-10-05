"""Official LTS layers that replace the OSM estimate where a city publishes one.

Supported now: tables keyed by OSM way id (Cook County's LTS layer for Chicago carries `way_id`).
Layers on the city's own centerlines (Boston BLTS, DVRPC for Philadelphia) need a spatial join to
OSM ways; that join is not built yet, so those cities run on the OSM estimate for now.
"""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Overrides:
    by_way: dict[int, int] = field(default_factory=dict)
    sources: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, specs: list[dict]) -> "Overrides":
        o = cls()
        for spec in specs:
            path = Path(spec["path"])
            id_col, lts_col = spec.get("way_id", "way_id"), spec.get("lts", "lts")
            rows = (json.loads(path.read_text())["features"] if path.suffix in {".json", ".geojson"}
                    else list(csv.DictReader(path.open())))
            n = 0
            for r in rows:
                props = r.get("properties", r)
                try:
                    # LTS may arrive as 3, 3.0 or "LTS 3".
                    way, lts = int(float(props[id_col])), int(re.search(r"\d", str(props[lts_col])).group())
                except (KeyError, TypeError, ValueError, AttributeError):
                    continue
                if 1 <= lts <= 4:
                    o.by_way[way] = lts
                    n += 1
            o.sources.append(f"{spec.get('name', path.name)}: {n} ways")
        return o

    def get(self, way_id: int) -> int | None:
        return self.by_way.get(way_id)

    def describe(self) -> list[str]:
        return self.sources
