"""
Incident state for the Caraballeda case study.

Field photo reports are classified by Model 1 (Collapsed / Damaged / Intact)
and override the damage class of the nearest building, so the rescue plan
reacts to new information from the field.
"""

import json
import math
import threading
from datetime import datetime, timezone
from pathlib import Path

import rescue

REPORTS_FILE = Path(__file__).resolve().parent / "data" / "field_reports.json"

# Model 1 class -> building damage class used by the planner
MODEL1_TO_DAMAGE = {
    "Collapsed": ("destroyed", 3),
    "Damaged": ("major-damage", 2),
    "Intact": ("no-damage", 0),
}

MIN_CONFIDENCE = 60.0        # percent; below this a report is logged but not applied
MAX_SNAP_M = 60.0            # report must be within this distance of a building

_lock = threading.Lock()
_scene_cache = {"version": None, "scene": None}


def _read():
    if not REPORTS_FILE.exists():
        return []
    return json.loads(REPORTS_FILE.read_text(encoding="utf-8"))


def _write(reports):
    REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORTS_FILE.write_text(json.dumps(reports, indent=2), encoding="utf-8")


def list_reports():
    with _lock:
        return _read()


def clear_reports():
    with _lock:
        _write([])
        _scene_cache["version"] = None


def nearest_building(lat, lon):
    base = rescue.load_case_scene()
    kx, ky = base.m_per_deg_lon, base.m_per_deg_lat
    best, best_d = None, math.inf
    for b in base.buildings:
        d = math.hypot((b["lon"] - lon) * kx, (b["lat"] - lat) * ky)
        if d < best_d:
            best, best_d = b, d
    return best, best_d


def add_report(lat, lon, prediction, confidence, image_name):
    building, distance = nearest_building(lat, lon)
    if building is None or distance > MAX_SNAP_M:
        raise ValueError(
            f"No building within {int(MAX_SNAP_M)} m of that point "
            f"(nearest is {distance:.0f} m away). Click closer to a building."
        )

    damage, _ = MODEL1_TO_DAMAGE[prediction]
    applied = confidence >= MIN_CONFIDENCE

    with _lock:
        reports = _read()
        report = {
            "id": (reports[-1]["id"] + 1) if reports else 1,
            "building_id": building["id"],
            "lat": building["lat"],
            "lon": building["lon"],
            "prediction": prediction,
            "confidence": round(confidence, 1),
            "mapped_damage": damage,
            "previous_damage": building["damage"],
            "applied": applied,
            "image_name": image_name,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        reports.append(report)
        _write(reports)
        _scene_cache["version"] = None
    return report


def current_scene():
    """Caraballeda scene with applied field reports merged in."""
    with _lock:
        reports = _read()
        version = tuple((r["id"], r["applied"]) for r in reports)
        if _scene_cache["version"] == version:
            return _scene_cache["scene"]

    base = rescue.load_case_scene()
    overrides = {}
    for r in reports:                      # later reports win
        if r["applied"]:
            overrides[r["building_id"]] = r["mapped_damage"]

    if not overrides:
        scene = base
    else:
        class_ids = {"no-damage": 0, "minor-damage": 1,
                     "major-damage": 2, "destroyed": 3}
        buildings = []
        for b in base.buildings:
            if b["id"] in overrides:
                b = dict(b, damage=overrides[b["id"]],
                         damage_class=class_ids[overrides[b["id"]]])
            buildings.append(b)
        scene = rescue.Scene(base.name, buildings, base.roads, base.services)

    with _lock:
        _scene_cache["version"] = version
        _scene_cache["scene"] = scene
    return scene


def apply_to_geojson(data):
    """Merge applied field reports into the building GeoJSON (in place)."""
    class_ids = {"no-damage": 0, "minor-damage": 1, "major-damage": 2, "destroyed": 3}
    overrides = {r["building_id"]: r["mapped_damage"] for r in list_reports() if r["applied"]}
    if not overrides:
        return data
    for feature in data["features"]:
        props = feature["properties"]
        new = overrides.get(str(props.get("building_id")))
        if new:
            props["damage"] = new
            props["damage_class"] = class_ids[new]
            props["field_verified"] = True
    return data
