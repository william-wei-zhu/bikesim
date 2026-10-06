"""Furth 2017 criteria at their boundaries, then the OSM tag mapping that feeds them."""

import pytest

from bikesim_data.lts import bike_lane_lts, classify, facility, lts_level, mixed_traffic_lts, parse_mph, usable


def test_protected_track_is_always_calm():
    assert lts_level("protected_track", 55, 8, "Principal Arterial") == 1


@pytest.mark.parametrize("speed,per_dir,lts", [(25, 1, 1), (30, 1, 2), (35, 1, 2), (40, 1, 3), (50, 1, 4),
                                                (30, 2, 2), (35, 2, 3), (50, 2, 4), (35, 3, 3), (40, 3, 4)])
def test_painted_lane(speed, per_dir, lts):
    assert bike_lane_lts("painted_lane", speed, per_dir) == lts


def test_buffer_earns_one_level_up_to_35_mph():
    assert bike_lane_lts("buffered_lane", 30, 1) == 1
    assert bike_lane_lts("buffered_lane", 35, 2) == 2
    assert bike_lane_lts("buffered_lane", 40, 1) == 3


@pytest.mark.parametrize("base,speed,lanes,per_dir,lts", [
    ("residential", 25, 2, 1, 1), ("residential", 30, 2, 1, 2), ("residential", 40, 2, 1, 3),
    ("tertiary", 20, 2, 1, 2), ("tertiary", 30, 2, 1, 3), ("tertiary", 35, 2, 1, 4),
    ("primary", 25, 2, 1, 3), ("primary", 30, 2, 1, 4),
    ("secondary", 25, 4, 2, 3), ("secondary", 30, 4, 2, 4), ("residential", 20, 6, 3, 4),
])
def test_mixed_traffic(base, speed, lanes, per_dir, lts):
    assert mixed_traffic_lts(base, speed, lanes, per_dir) == lts


@pytest.mark.parametrize("v,mph", [("25 mph", 25), ("40", 25), ("30 mph;25 mph", 30), ("signals", None), (None, None)])
def test_parse_mph(v, mph):
    assert parse_mph(v) == mph


@pytest.mark.parametrize("tags,fac", [
    ({"highway": "cycleway"}, "protected_track"),
    ({"highway": "secondary", "cycleway:right": "track"}, "protected_track"),
    ({"highway": "secondary", "cycleway:both": "lane"}, "painted_lane"),
    ({"highway": "secondary", "cycleway:left": "lane", "cycleway:left:buffer": "yes"}, "buffered_lane"),
    ({"highway": "secondary", "cycleway:right": "lane", "cycleway:right:separation": "flex_post"}, "protected_track"),
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
    ({"highway": "primary", "bicycle": "use_sidepath"}, False),
])
def test_usable(tags, ok):
    assert usable(tags) is ok


def test_quiet_residential_streets_are_calm_at_the_usual_limits():
    assert classify({"highway": "residential"}, 20).lts == 1
    f = classify({"highway": "residential"}, 25)
    assert f.lts == 1 and f.speed_estimated and f.speed == 25
    assert classify({"highway": "residential", "maxspeed": "35 mph"}, 25).lts == 2


def test_arterial_without_facility_is_hostile():
    f = classify({"highway": "primary", "maxspeed": "30 mph", "lanes": "2"}, 20)
    assert f.lts == 4 and f.function == "Principal Arterial"
    assert classify({"highway": "primary", "maxspeed": "30 mph", "lanes": "2", "cycleway:both": "lane"}, 20).lts == 2


def test_city_arterial_default_applies_to_unsigned_arterials():
    assert classify({"highway": "secondary", "lanes": "2"}, 20).speed == 30
    assert classify({"highway": "secondary", "lanes": "2"}, 20, arterial_mph=25).speed == 25


@pytest.mark.parametrize("tags,ok", [
    ({"highway": "service", "service": "alley"}, True),
    ({"highway": "service", "name": "Campus Drive"}, True),
    ({"highway": "service"}, False),
    ({"highway": "service", "bicycle": "designated"}, True),
])
def test_service_roads(tags, ok):
    assert usable(tags) is ok
