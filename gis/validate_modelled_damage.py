"""Compare MODELLED damage (USGS ShakeMap + fragility) with the REAL assessed damage
in Caraballeda. Needs internet and a working Overpass server (can take minutes).

Run:  python gis/validate_modelled_damage.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
import sys, json, collections, time

import region, rescue

EVENT = "us6000t7zp"          # the real 2026 Venezuela earthquake in the USGS catalogue
d = region.event_detail(EVENT)
print("event", d["title"], d["magnitude"], d["time"], "shakemap", d["has_shakemap"], "pager", (d["pager"] or {}).get("alert_level"))

real = rescue.load_case_scene()
for name, lat, lon in [("Caraballeda centre", 10.6086, -66.8505), ("west", 10.6150, -66.8650), ("east", 10.6050, -66.8300)]:
    t = time.time()
    scene, bounds, shaking = region.build_scenario_scene(EVENT, lat, lon)
    mod = collections.Counter(b["damage"] for b in scene.buildings)
    inside = [b for b in real.buildings
              if bounds["west"] <= b["lon"] <= bounds["east"] and bounds["south"] <= b["lat"] <= bounds["north"]]
    ref = collections.Counter(b["damage"] for b in inside)
    def share(c):
        n = sum(c.values()); return round(100 * (n - c["no-damage"]) / n, 1) if n else None
    def severe(c):
        n = sum(c.values()); return round(100 * (c["major-damage"] + c["destroyed"]) / n, 2) if n else None
    print(f"{name}: MMI {min(shaking):.1f}-{max(shaking):.1f} | modelled n={sum(mod.values())} damaged {share(mod)}% severe {severe(mod)}% | real(HOT) n={len(inside)} damaged {share(ref)}% severe {severe(ref)}% | {time.time()-t:.0f}s")
