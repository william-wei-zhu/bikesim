"""Level of traffic stress (1 calm .. 4 hostile) from OpenStreetMap tags.

The rules table is RideScore DC's (ridescoredc-models `ridescore_v1/lts.py`), so a block scores
the same in Seattle as it would in DC. Only the inputs differ: DC reads DDOT's roadway blocks,
this module reads OSM tags and turns them into the same four inputs:

    facility  protected_track | buffered_lane | painted_lane | none
    speed     posted mph (city default by road class when OSM has no maxspeed)
    lanes     total travel lanes (default by road class when OSM has no lanes)
    function  "local" for residential-type streets, else a road-class label
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# --- RideScore DC v1 thresholds (ridescoredc-models config.py), kept identical ---
MARKED_LANE_SPEED_2, MARKED_LANE_LANES_2 = 25, 2
MARKED_LANE_SPEED_3, MARKED_LANE_LANES_3 = 30, 3
NO_FACILITY_SPEED_2, NO_FACILITY_SPEED_3, NO_FACILITY_LANES = 20, 30, 2
WORST = 4

# Streets the bike may use at all. Anything else (motorways, steps, sidewalks drawn as their own
# ways, construction) is dropped before routing.
ROADS = {
    "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service", "road",
}
PATHS = {"cycleway", "path", "footway", "pedestrian", "bridleway", "track"}
LOCAL = {"residential", "living_street", "unclassified", "service", "road", "track"}

# Road-class labels for the "why is it hostile?" panel (DDOT's functional class wording).
FUNCTION_LABEL = {
    "trunk": "Principal Arterial", "trunk_link": "Principal Arterial",
    "primary": "Principal Arterial", "primary_link": "Principal Arterial",
    "secondary": "Minor Arterial", "secondary_link": "Minor Arterial",
    "tertiary": "Collector", "tertiary_link": "Collector",
}

# Fill-ins when OSM is silent. Local streets take the city's default limit (City.default_mph).
DEFAULT_MPH = {"trunk": 40, "primary": 35, "secondary": 30, "tertiary": 25}
DEFAULT_LANES = {"trunk": 4, "primary": 4, "secondary": 2, "tertiary": 2}

_NUM = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mph|km/h|kmh|kph)?", re.I)


@dataclass(frozen=True)
class Facts:
    """What the LTS rules saw for one OSM way; also written to blocks.json for the UI."""

    lts: int
    facility: str
    speed: int
    speed_estimated: bool
    lanes: int
    lanes_estimated: bool
    function: str
    rule: str  # which branch decided it: osm_lts, trail_rule, track_rule


def usable(tags: dict[str, str]) -> bool:
    """True if a bike may ride this way (and it is not a duplicate sidewalk or a parking aisle)."""
    hw = tags.get("highway", "")
    bike = tags.get("bicycle", "")
    if bike in {"no", "dismount"} or tags.get("area") == "yes":
        return False
    if tags.get("access") in {"no", "private"} and bike not in {"yes", "designated", "permissive"}:
        return False
    if hw in ROADS:
        return tags.get("service") not in {"parking_aisle", "driveway", "drive-through", "emergency_access"}
    if hw == "cycleway":
        return True
    if hw in PATHS:
        # Sidewalks and footpaths only when bikes are explicitly welcome.
        if tags.get("footway") in {"sidewalk", "crossing"}:
            return bike == "designated"
        return bike in {"yes", "designated", "permissive"}
    return False


def parse_mph(v: str | None) -> int | None:
    if not v:
        return None
    m = _NUM.match(v.split(";")[0])
    if not m:
        return None
    n = float(m.group(1))
    unit = (m.group(2) or "").lower()
    # US maxspeed is tagged "25 mph"; a bare number is km/h by OSM convention.
    return round(n if unit == "mph" else n / 1.609)


def parse_int(v: str | None) -> int | None:
    if not v:
        return None
    m = _NUM.match(v.split(";")[0])
    return int(float(m.group(1))) if m else None


def facility(tags: dict[str, str]) -> str:
    """protected_track, buffered_lane, painted_lane or none, from OSM's cycleway tags."""
    hw = tags.get("highway", "")
    if hw == "cycleway" or hw in PATHS:
        return "protected_track"
    vals = [tags.get(k, "") for k in ("cycleway", "cycleway:both", "cycleway:left", "cycleway:right")]
    if "track" in vals:
        return "protected_track"
    if any(v in {"lane", "opposite_lane"} for v in vals):
        sides = ("cycleway", "cycleway:both", "cycleway:left", "cycleway:right")
        buffered = any(tags.get(f"{s}:buffer", "no") not in {"no", ""} or tags.get(f"{s}:separation", "") for s in sides)
        return "buffered_lane" if buffered else "painted_lane"
    return "none"


def classify(tags: dict[str, str], default_mph: int) -> Facts:
    """LTS for one usable OSM way. `default_mph` is the city's limit for unsigned local streets."""
    hw = tags.get("highway", "")
    fac = facility(tags)
    function = "local" if hw in LOCAL else FUNCTION_LABEL.get(hw, "local" if hw in PATHS or hw == "cycleway" else "Collector")

    speed = parse_mph(tags.get("maxspeed"))
    speed_est = speed is None
    if speed is None:
        speed = DEFAULT_MPH.get(hw.removesuffix("_link"), default_mph)
    lanes = parse_int(tags.get("lanes"))
    lanes_est = lanes is None
    if lanes is None:
        lanes = DEFAULT_LANES.get(hw.removesuffix("_link"), 2 if tags.get("oneway") != "yes" else 1)

    if hw in PATHS or hw == "cycleway":
        rule = "trail_rule"
    elif fac == "protected_track":
        rule = "track_rule"
    else:
        rule = "osm_lts"
    return Facts(lts_level(fac, speed, lanes, function), fac, speed, speed_est, lanes, lanes_est, function, rule)


def lts_level(fac: str, speed: float, lanes: float, function: str = "") -> int:
    """RideScore DC v1 rules table, unchanged."""
    if fac == "protected_track":
        return 1
    if fac in {"buffered_lane", "painted_lane"}:
        if speed <= MARKED_LANE_SPEED_2 and lanes <= MARKED_LANE_LANES_2:
            return 2
        if speed <= MARKED_LANE_SPEED_3 and lanes <= MARKED_LANE_LANES_3:
            return 3
        return WORST
    on_local = (function or "").lower() == "local"
    few = lanes <= NO_FACILITY_LANES
    if speed <= NO_FACILITY_SPEED_2 and few and on_local:
        return 2
    if speed <= NO_FACILITY_SPEED_3 and few and on_local:
        return 3
    return WORST
