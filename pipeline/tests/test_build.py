import json
from pathlib import Path

from bikesim_data.build import City, build

FIX = Path(__file__).parent / "fixtures" / "tiny.osm"
CITY = City(slug="tiny", name="Tiny", box=(-80.01, 39.99, -79.98, 40.01), default_mph=25)


def test_build_writes_the_app_schema(tmp_path):
    meta = build(CITY, FIX, tmp_path, legacy_json=True)
    net = json.loads((tmp_path / "network.json").read_text())
    blocks = json.loads((tmp_path / "blocks.json").read_text())
    names = net["names"]
    by_name = {}
    for u, v, length, lts, src, name, block, coords in net["edges"]:
        assert 0 <= u < len(net["nodes"]["lon"]) and 0 <= v < len(net["nodes"]["lon"])
        assert length > 0 and len(coords) >= 4 and len(coords) % 2 == 0
        assert blocks["rows"][block][1] == names[name]
        by_name.setdefault(names[name], set()).add(lts)
    assert by_name["Big Avenue"] == {4}
    assert by_name["West Street"] == {1}       # residential, posted 20 mph
    assert by_name["Quiet Street"] == {1}      # residential, unsigned: city default 25 mph
    assert by_name["Middle Road"] == {1}       # painted lane, 25 mph, one lane each way
    assert by_name["Tiny Trail"] == {1}
    # Dropped: the sidewalk and motorway (unusable) and the island loop (not connected).
    assert not {"Freeway", "Island Loop"} & set(by_name)
    # Big Avenue is split at West/Middle/trail intersections into 2 blocks.
    assert sum(1 for e in net["edges"] if names[e[5]] == "Big Avenue") == 2
    assert meta["edges"] == len(net["edges"])
    assert meta["dropped_edges"] == 2  # the island loop, split in two, then dropped as an island

    pois = json.loads((tmp_path / "pois.json").read_text())
    assert {(p["t"], p["n"]) for p in pois} == {("school", "Tiny Elementary"), ("metro", "Tiny Station")}
    assert all(p["d"] < 100 for p in pois)


def test_binary_round_trip(tmp_path):
    from bikesim_data.binary import read_network_bin

    build(CITY, FIX, tmp_path, legacy_json=True)
    js = json.loads((tmp_path / "network.json").read_text())
    bn = read_network_bin(tmp_path / "network.bin")
    assert bn["names"] == js["names"] and bn["src"] == js["src"]
    assert len(bn["edges"]) == len(js["edges"])
    for a, b in zip(js["edges"], bn["edges"]):
        assert a[:2] == b[:2] and a[3:7] == b[3:7] and abs(a[2] - b[2]) < 0.05
        assert all(abs(x - y) < 2e-6 for x, y in zip(a[7], b[7]))
