"""Street km and calm/hostile shares per city, from each built network.bin, for the home page cards.

    uv run python scripts/city_stats.py      -> ../lib/city-stats.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bikesim_data.binary import read_network_bin  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "out"
stats = {}
for d in sorted(OUT.iterdir()):
    f = d / "network.bin"
    if not f.exists() or d.name.endswith("-osm"):
        continue
    net = read_network_bin(f)
    km = [0.0] * 5
    for e in net["edges"]:
        km[e[3]] += e[2] / 1000
    total = sum(km) or 1
    stats[d.name] = {"km": round(total), "calm": round((km[1] + km[2]) / total, 3), "hostile": round(km[4] / total, 3)}
    print(d.name, stats[d.name])
(Path(__file__).resolve().parents[2] / "lib" / "city-stats.json").write_text(json.dumps(stats, indent=1) + "\n")
