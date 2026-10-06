import json

from bikesim_data.overrides import Overrides

# ~0.0001 deg lat = 11 m. Two parallel east-west streets ~33 m apart, each ~170 m long.
NORTH = [(-80.0, 40.0003), (-79.999, 40.0003), (-79.998, 40.0003)]
SOUTH = [(-80.0, 40.0), (-79.999, 40.0), (-79.998, 40.0)]


def _layer(tmp_path, feats, name="layer.geojson"):
    p = tmp_path / name
    p.write_text(json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": props, "geometry": {"type": "LineString", "coordinates": coords}}
        for props, coords in feats]}))
    return p


def test_spatial_join_matches_the_parallel_street_it_sits_on(tmp_path):
    path = _layer(tmp_path, [
        # Official centerline ~4 m north of the south street, drawn in the opposite direction.
        ({"LTS": 2}, [[-79.998, 40.00004], [-80.0, 40.00004]]),
        # A cross street (north-south) through both: wrong bearing, never matches.
        ({"LTS": 4}, [[-79.999, 39.999], [-79.999, 40.001]]),
        # No score (Boston's 0): ignored.
        ({"LTS": 0}, [[-80.0, 40.0003], [-79.998, 40.0003]]),
    ])
    ov = Overrides.load([{"name": "Test", "path": str(path), "lts": "LTS", "join": "spatial"}])
    ov.join({1: SOUTH, 2: NORTH})
    assert ov.get(1) == 2
    assert ov.get(2) is None  # 33 m away from the official line, and the cross street's bearing is wrong
    assert ov.describe() == ["Test: 1 of 2 OSM roads matched (2 segments)"]


def test_spatial_join_needs_half_the_way_covered(tmp_path):
    # Covers ~30% of the south street.
    path = _layer(tmp_path, [({"lts": 3}, [[-80.0, 40.0], [-79.9994, 40.0]])])
    ov = Overrides.load([{"path": str(path), "join": "spatial"}])
    ov.join({1: SOUTH})
    assert ov.get(1) is None
    # Covers ~70%: overridden.
    path = _layer(tmp_path, [({"lts": 3}, [[-80.0, 40.0], [-79.9986, 40.0]])], "b.geojson")
    ov = Overrides.load([{"path": str(path), "join": "spatial"}])
    ov.join({1: SOUTH})
    assert ov.get(1) == 3


def test_spatial_join_takes_the_segment_with_most_overlap(tmp_path):
    path = _layer(tmp_path, [
        ({"lts": "LTS 4"}, [[-80.0, 40.0], [-79.9993, 40.0]]),    # ~60 m
        ({"lts": "LTS 1"}, [[-79.9993, 40.0], [-79.998, 40.0]]),  # ~110 m
    ])
    ov = Overrides.load([{"path": str(path), "join": "spatial"}])
    ov.join({1: SOUTH})
    assert ov.get(1) == 1


def test_way_id_layer_beats_spatial_and_missing_files_warn(tmp_path, capsys):
    ids = _layer(tmp_path, [({"way_id": 1.0, "ltsrank": "4"}, [[0, 0], [1, 1]])], "ids.geojson")
    geo = _layer(tmp_path, [({"lts": 2}, [[-80.0, 40.0], [-79.998, 40.0]])], "geo.geojson")
    ov = Overrides.load([
        {"name": "Missing", "path": str(tmp_path / "nope.geojson")},
        {"name": "Ids", "path": str(ids), "way_id": "way_id", "lts": "ltsrank"},
        {"name": "Geo", "path": str(geo), "join": "spatial"},
    ])
    assert "not found" in capsys.readouterr().out
    ov.join({1: SOUTH})
    assert ov.get(1) == 4
    assert ov.describe()[:2] == ["Missing: not loaded", "Ids: 1 ways"]
