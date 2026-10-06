"""Level of traffic stress (1 calm .. 4 hostile) from OpenStreetMap tags.

Criteria follow Furth, Mekuria & Nixon (2016, revised 2017 "LTS criteria" tables), the method most
US cities and the OSM-based stress models (BikeOttawa stressmodel, Conveyal) use. OSM has no traffic
counts, so road class stands in for traffic volume:

    residential / living street / service / unclassified  ~ low-volume local street (no centre line)
    tertiary                                               ~ collector
    secondary / primary / trunk                            ~ arterial

Each way becomes four inputs (facility, speed, lanes per direction, road class), then one of three
tables decides: separated paths and tracks, bike lanes, or mixed traffic.

DC does not use this module for its own streets (RideScore DC scores them from DDOT data); DC is
used to calibrate it (see calibrate.py).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Streets a bike may use at all. Anything else (motorways, steps, sidewalks drawn as their own
# ways, construction) is dropped before routing.
ROADS = {
    "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service", "road",
}
PATHS = {"cycleway", "path", "footway", "pedestrian", "bridleway", "track"}
LOCAL = {"residential", "living_street", "unclassified", "service", "road", "track"}
ARTERIAL = {"trunk", "primary", "secondary"}

# Road-class labels for the "why is it hostile?" panel.
FUNCTION_LABEL = {
    "trunk": "Principal Arterial", "primary": "Principal Arterial",
    "secondary": "Minor Arterial", "tertiary": "Collector",
}

# Fill-ins when OSM is silent. Local streets take the city's default limit (City.default_mph);
# arterials take the city's arterial default when it has one (Seattle, NYC: 25).
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
    rule: str  # which table decided it: osm_lts (lanes/mixed traffic), track_rule, trail_rule


def usable(tags: dict[str, str]) -> bool:
    """True if a bike may ride this way (and it is not a duplicate sidewalk or a parking aisle)."""
    hw = tags.get("highway", "")
    bike = tags.get("bicycle", "")
    if bike in {"no", "dismount", "use_sidepath"} or tags.get("area") == "yes":
        return False
    if tags.get("access") in {"no", "private"} and bike not in {"yes", "designated", "permissive"}:
        return False
    if hw == "service":
        # Alleys and named service roads route; unnamed lot aisles, driveways and access lanes only add bulk.
        if tags.get("service") in {"parking_aisle", "driveway", "drive-through", "emergency_access"}:
            return False
        return tags.get("service") == "alley" or bool(tags.get("name")) or bike in {"yes", "designated", "permissive"}
    if hw in ROADS:
        return True
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


_SIDES = ("cycleway", "cycleway:both", "cycleway:left", "cycleway:right")


def facility(tags: dict[str, str]) -> str:
    """protected_track, buffered_lane, painted_lane or none, from OSM's cycleway tags."""
    hw = tags.get("highway", "")
    if hw == "cycleway" or hw in PATHS:
        return "protected_track"
    vals = [tags.get(k, "") for k in _SIDES]
    if "track" in vals or "separate" in vals and tags.get("bicycle") in {"use_sidepath", "no"}:
        return "protected_track"
    if any(v in {"lane", "opposite_lane"} for v in vals):
        # A lane with physical separation (posts, kerb) counts as protected; paint only as buffered.
        sep = [tags.get(f"{s}:separation", "") + tags.get(f"{s}:separation:left", "") for s in _SIDES]
        if any(re.search(r"kerb|flex_post|bollard|planter|jersey|parking", s) for s in sep):
            return "protected_track"
        buffered = any(tags.get(f"{s}:buffer", "no") not in {"no", ""} for s in _SIDES) or any(sep)
        return "buffered_lane" if buffered else "painted_lane"
    return "none"


def classify(tags: dict[str, str], default_mph: int, arterial_mph: int | None = None) -> Facts:
    """LTS for one usable OSM way. `default_mph` is the city's limit for unsigned local streets."""
    hw = tags.get("highway", "")
    base = hw.removesuffix("_link")
    fac = facility(tags)
    is_path = hw in PATHS or hw == "cycleway"
    function = "local" if hw in LOCAL or is_path else FUNCTION_LABEL.get(base, "Collector")

    speed = parse_mph(tags.get("maxspeed"))
    speed_est = speed is None
    if speed is None:
        speed = (arterial_mph if arterial_mph and base in ARTERIAL | {"tertiary"} else DEFAULT_MPH.get(base, default_mph))
    oneway = tags.get("oneway") in {"yes", "-1", "1"}
    lanes = parse_int(tags.get("lanes"))
    lanes_est = lanes is None
    if lanes is None:
        lanes = DEFAULT_LANES.get(base, 1 if oneway else 2)
    per_dir = lanes if oneway else max(1, (lanes + 1) // 2)

    if is_path:
        # Pedestrian streets and shared footpaths are calm but not a bike facility.
        lts, rule = (2 if hw in {"pedestrian", "footway"} else 1), "trail_rule"
    elif fac == "protected_track":
        lts, rule = 1, "track_rule"
    elif hw == "living_street":
        lts, rule = 1, "osm_lts"
    elif fac in {"buffered_lane", "painted_lane"}:
        lts, rule = bike_lane_lts(fac, speed, per_dir), "osm_lts"
    else:
        lts, rule = mixed_traffic_lts(base, speed, lanes, per_dir), "osm_lts"
    return Facts(lts, fac, speed, speed_est, lanes, lanes_est, function, rule)


def bike_lane_lts(fac: str, speed: float, per_dir: int) -> int:
    """Furth 2017, bike lane not alongside parking. A buffer earns one level back up to 35 mph."""
    if per_dir <= 1:
        lts = 1 if speed <= 25 else 2 if speed <= 35 else 3 if speed <= 45 else 4
    elif per_dir == 2:
        lts = 2 if speed <= 30 else 3 if speed <= 45 else 4
    else:
        lts = 3 if speed <= 35 else 4
    if fac == "buffered_lane" and speed <= 35 and lts > 1:
        lts -= 1
    return lts


def mixed_traffic_lts(base: str, speed: float, lanes: int, per_dir: int) -> int:
    """Furth 2017 mixed-traffic table, with road class standing in for daily traffic."""
    if per_dir >= 3:
        return 4
    if per_dir == 2:
        return 3 if speed <= 25 else 4
    if base in LOCAL:
        # Unlaned local street, low volume.
        return 1 if speed <= 25 else 2 if speed <= 35 else 3
    if base == "tertiary":
        # Collector: one lane each way, a few thousand cars a day.
        return 2 if speed <= 20 else 3 if speed <= 30 else 4
    # Arterial with one lane each way: heavy traffic (Furth: over 8,000 a day).
    return 3 if speed <= 25 else 4


def lts_level(fac: str, speed: float, lanes: float, function: str = "") -> int:
    """Convenience wrapper: lanes is the total; function 'local' means a residential street."""
    if fac == "protected_track":
        return 1
    per_dir = max(1, (int(lanes) + 1) // 2)
    if fac in {"buffered_lane", "painted_lane"}:
        return bike_lane_lts(fac, speed, per_dir)
    base = "residential" if (function or "").lower() == "local" else "secondary"
    return mixed_traffic_lts(base, speed, int(lanes), per_dir)
