"""The DC rules table at its boundaries (cases from ridescoredc-models tests/test_lts.py), then the
OSM tag mapping that feeds it."""

import pytest

from bikesim_data.lts import classify, facility, lts_level, parse_mph, usable


def test_protected_track_is_always_calm():
    assert lts_level("protected_track", 55, 8, "Principal Arterial") == 1


@pytest.mark.parametrize("fac", ["buffered_lane", "painted_lane"])
def test_marked_lane_boundaries(fac):
    assert lts_level(fac, 25, 2) == 2
    assert lts_level(fac, 26, 2) == 3
    assert lts_level(fac, 25, 3) == 3
    assert lts_level(fac, 30, 3) == 3
    assert lts_level(fac, 31, 3) == 4
    assert lts_level(fac, 30, 4) == 4


def test_no_facility_boundaries():
    assert lts_level("none", 20, 2, "local") == 2
    assert lts_level("none", 21, 2, "Local") == 3
    assert lts_level("none", 30, 2, "local") == 3
    assert lts_level("none", 31, 2, "local") == 4
    assert lts_level("none", 20, 3, "local") == 4
    assert lts_level("none", 20, 2, "Collector") == 4


@pytest.mark.parametrize("v,mph", [("25 mph", 25), ("40", 25), ("30 mph;25 mph", 30), ("signals", None), (None, None)])
def test_parse_mph(v, mph):
    assert parse_mph(v) == mph


@pytest.mark.parametrize("tags,fac", [
    ({"highway": "cycleway"}, "protected_track"),
    ({"highway": "secondary", "cycleway:right": "track"}, "protected_track"),
    ({"highway": "secondary", "cycleway:both": "lane"}, "painted_lane"),
    ({"highway": "secondary", "cycleway:left": "lane", "cycleway:left:buffer": "yes"}, "buffered_lane"),
    ({"highway": "secondary", "cycleway": "shared_lane"}, "none"),
])
def test_facility(tags, fac):
    assert facility(tags) == fac


@pytest.mark.parametrize("tags,ok", [
    ({"highway": "residential"}, True),
    ({"highway": "motorway"}, False),
    ({"highway": "footway", "footway": "sidewalk"}, False),
    ({"highway": "footway", "bicycle": "designated"}, True),
    ({"highway": "path"}, False),
    ({"highway": "service", "service": "parking_aisle"}, False),
    ({"highway": "residential", "access": "private"}, False),
    ({"highway": "primary", "bicycle": "no"}, False),
])
def test_usable(tags, ok):
    assert usable(tags) is ok


def test_city_default_speed_decides_residential_streets():
    assert classify({"highway": "residential"}, 20).lts == 2
    assert classify({"highway": "residential"}, 25).lts == 3
    f = classify({"highway": "residential"}, 25)
    assert f.speed_estimated and f.speed == 25


def test_arterial_without_facility_is_hostile():
    f = classify({"highway": "primary", "maxspeed": "30 mph", "lanes": "2"}, 20)
    assert f.lts == 4 and f.function == "Principal Arterial"
