"""
AIQuake rescue planning engine.

Turns building/region damage data into:

  * population-impact estimates (occupants, expected trapped, displaced)
  * ranked rescue-priority zones
  * road-network routes from an emergency base to those zones

A `Scene` bundles damage objects, roads and facilities for one disaster area.
The Caraballeda case study is one scene; a scene can also be built on the fly
from Model 2 output for any uploaded image pair (see `scene_from_damage_geojson`).

All population figures are *planning estimates* derived from rule-of-thumb
occupancy and entrapment ratios. They are not casualty counts and must be
validated by field assessment.
"""

import heapq
import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np


CASE_DIR = (
    Path(__file__).resolve().parent.parent
    / "gis"
    / "venezuela"
    / "caraballeda"
)

BUILDINGS_FILE = CASE_DIR / "output" / "caraballeda_building_damage.geojson"
ROADS_FILE = CASE_DIR / "osm" / "roads.json"
SERVICES_FILE = CASE_DIR / "osm" / "services.json"


# ------------------------------------------------------------------
# Planning assumptions (documented so they can be challenged / tuned)
# ------------------------------------------------------------------

FLOORS_ASSUMED = 1.5          # low-rise housing
M2_PER_PERSON = 30.0          # gross floor area per occupant
MIN_FOOTPRINT_M2 = 15.0       # smaller polygons are sheds / noise
MAX_OCCUPANTS = 80            # cap per building (avoids outlier footprints)

# Uploaded imagery gives damage *regions*, not individual buildings, so only
# part of each region's area is assumed to be built-up floor space.
REGION_BUILT_SHARE = 0.35
MAX_REGION_OCCUPANTS = 400

TRAPPED_FRACTION = {
    "no-damage": 0.0,
    "minor-damage": 0.0,
    "major-damage": 0.06,
    "destroyed": 0.30,
}

DISPLACED_FRACTION = {
    "no-damage": 0.0,
    "minor-damage": 0.10,
    "major-damage": 0.75,
    "destroyed": 1.0,
}

OCCUPANCY_BY_TIME = {"night": 0.90, "day": 0.55}

ROAD_SPEED_KMH = {
    "motorway": 45, "trunk": 45, "primary": 35, "secondary": 30,
    "tertiary": 28, "unclassified": 22, "residential": 20,
    "living_street": 10, "service": 12,
}

DEBRIS_RADIUS_M = 20.0
DEBRIS_PENALTY = 2.5
ZONE_CELL_DEG = 0.002         # ~220 m grid for rescue zones

TIERS = (
    (0.50, "CRITICAL"),
    (0.25, "HIGH"),
    (0.10, "MEDIUM"),
    (0.0, "LOW"),
)


# ------------------------------------------------------------------
# Scene
# ------------------------------------------------------------------

class Scene:
    """Damage objects + roads + facilities for one disaster area."""

    def __init__(self, name, buildings, roads, services,
                 unit="buildings", is_region_based=False):
        self.name = name
        self.buildings = buildings
        self.roads = roads
        self.services = services
        self.unit = unit
        self.is_region_based = is_region_based

        lats = [b["lat"] for b in buildings] or [0.0]
        self.lat0 = sum(lats) / len(lats)
        self.m_per_deg_lat = 110574.0
        self.m_per_deg_lon = 111320.0 * math.cos(math.radians(self.lat0))

        self._graph = None
        self._facilities = None

    # -- geometry ------------------------------------------------------

    def to_xy(self, lon, lat):
        return (lon * self.m_per_deg_lon, lat * self.m_per_deg_lat)

    def distance_m(self, a, b):
        return math.hypot(
            (a[0] - b[0]) * self.m_per_deg_lon,
            (a[1] - b[1]) * self.m_per_deg_lat,
        )

    # -- people --------------------------------------------------------

    def occupants_of(self, building, time_of_day="night"):
        if building["area_m2"] < MIN_FOOTPRINT_M2:
            return 0.0
        floor_area = building["area_m2"] * FLOORS_ASSUMED
        if self.is_region_based:
            people = min(
                floor_area * REGION_BUILT_SHARE / M2_PER_PERSON,
                MAX_REGION_OCCUPANTS,
            )
        else:
            people = min(floor_area / M2_PER_PERSON, MAX_OCCUPANTS)
        return people * OCCUPANCY_BY_TIME.get(time_of_day, 0.9)

    def impact_summary(self, time_of_day="night"):
        counts = {k: 0 for k in TRAPPED_FRACTION}
        occupants = trapped = displaced = 0.0

        for b in self.buildings:
            counts[b["damage"]] = counts.get(b["damage"], 0) + 1
            people = self.occupants_of(b, time_of_day)
            occupants += people
            trapped += people * TRAPPED_FRACTION.get(b["damage"], 0)
            displaced += people * DISPLACED_FRACTION.get(b["damage"], 0)

        total = len(self.buildings)
        damaged = total - counts.get("no-damage", 0)

        return {
            "unit": self.unit,
            "total_buildings": total,
            "damaged_buildings": damaged,
            "damage_counts": counts,
            "damaged_share_pct": round(100 * damaged / total, 2) if total else 0,
            "estimated_population": round(occupants),
            "estimated_trapped": round(trapped),
            "estimated_displaced": round(displaced),
            "time_of_day": time_of_day,
        }

    # -- zones ---------------------------------------------------------

    def build_zones(self, time_of_day="night"):
        cells = {}
        for b in self.buildings:
            if b["damage_class"] < 1:
                continue
            key = (
                math.floor(b["lon"] / ZONE_CELL_DEG),
                math.floor(b["lat"] / ZONE_CELL_DEG),
            )
            people = self.occupants_of(b, time_of_day)
            trapped = people * TRAPPED_FRACTION[b["damage"]]
            displaced = people * DISPLACED_FRACTION[b["damage"]]

            cell = cells.setdefault(key, {
                "buildings": 0, "minor": 0, "major": 0, "destroyed": 0,
                "trapped": 0.0, "displaced": 0.0,
                "wx": 0.0, "wy": 0.0, "w": 0.0,
            })
            cell["buildings"] += 1
            cell[{1: "minor", 2: "major", 3: "destroyed"}[b["damage_class"]]] += 1
            cell["trapped"] += trapped
            cell["displaced"] += displaced

            weight = 0.2 + trapped * 3 + displaced
            cell["wx"] += b["lon"] * weight
            cell["wy"] += b["lat"] * weight
            cell["w"] += weight

        zones = []
        for cell in cells.values():
            score = 3 * cell["trapped"] + 0.5 * cell["displaced"]
            zones.append({
                "lon": cell["wx"] / cell["w"],
                "lat": cell["wy"] / cell["w"],
                "damaged_buildings": cell["buildings"],
                "minor": cell["minor"],
                "major": cell["major"],
                "destroyed": cell["destroyed"],
                "est_trapped": round(cell["trapped"], 1),
                "est_displaced": round(cell["displaced"]),
                "priority_score": round(score, 2),
            })

        zones.sort(key=lambda z: z["priority_score"], reverse=True)
        top = zones[0]["priority_score"] if zones else 1.0
        for rank, zone in enumerate(zones, start=1):
            zone["rank"] = rank
            zone["id"] = f"Z{rank:02d}"
            ratio = zone["priority_score"] / top if top else 0
            zone["tier"] = next(n for limit, n in TIERS if ratio >= limit)
        return zones

    # -- facilities ----------------------------------------------------

    @property
    def facilities(self):
        if self._facilities is None:
            out = []
            for element in self.services:
                tags = element.get("tags", {})
                kind = _classify_service(tags)
                lat = element.get("lat") or element.get("center", {}).get("lat")
                lon = element.get("lon") or element.get("center", {}).get("lon")
                if not kind or lat is None:
                    continue
                out.append({
                    "id": f"{element['type']}/{element['id']}",
                    "type": kind,
                    "name": tags.get("name") or kind.replace("_", " ").title(),
                    "lat": lat,
                    "lon": lon,
                })
            self._facilities = out
        return self._facilities

    # -- road graph ----------------------------------------------------

    @property
    def graph(self):
        if self._graph is None:
            self._graph = self._build_graph()
        return self._graph

    def _build_graph(self):
        node_index, nodes, adjacency, edges = {}, [], [], []

        def node_of(lon, lat):
            key = (round(lon, 6), round(lat, 6))
            if key not in node_index:
                node_index[key] = len(nodes)
                nodes.append((lon, lat))
                adjacency.append([])
            return node_index[key]

        for way in self.roads:
            geom = way.get("geometry")
            if not geom or len(geom) < 2:
                continue
            highway = way["tags"]["highway"].replace("_link", "")
            speed = ROAD_SPEED_KMH.get(highway, 15) / 3.6
            previous = None
            for point in geom:
                current = node_of(point["lon"], point["lat"])
                if previous is not None and previous != current:
                    length = self.distance_m(nodes[previous], nodes[current])
                    edges.append({"a": previous, "b": current,
                                  "length": length, "speed": speed})
                previous = current

        if not nodes:
            return None

        severe = np.array([
            self.to_xy(b["lon"], b["lat"])
            for b in self.buildings if b["damage_class"] >= 2
        ])

        for edge in edges:
            mid = self.to_xy(
                (nodes[edge["a"]][0] + nodes[edge["b"]][0]) / 2,
                (nodes[edge["a"]][1] + nodes[edge["b"]][1]) / 2,
            )
            risk = False
            if len(severe):
                dist = np.hypot(severe[:, 0] - mid[0], severe[:, 1] - mid[1])
                risk = bool(dist.min() <= DEBRIS_RADIUS_M)
            edge["debris"] = risk
            seconds = edge["length"] / edge["speed"]
            edge["seconds"] = seconds * DEBRIS_PENALTY if risk else seconds
            adjacency[edge["a"]].append((edge["b"], edge))
            adjacency[edge["b"]].append((edge["a"], edge))

        # keep only the largest connected component
        seen = [-1] * len(nodes)
        sizes = []
        for start in range(len(nodes)):
            if seen[start] != -1:
                continue
            label = len(sizes)
            stack, size = [start], 0
            seen[start] = label
            while stack:
                node = stack.pop()
                size += 1
                for neighbour, _ in adjacency[node]:
                    if seen[neighbour] == -1:
                        seen[neighbour] = label
                        stack.append(neighbour)
            sizes.append(size)
        main = int(np.argmax(sizes))
        valid = np.array([i for i in range(len(nodes)) if seen[i] == main])
        coords = np.array([self.to_xy(*nodes[i]) for i in valid])

        return {"nodes": nodes, "adjacency": adjacency,
                "valid": valid, "coords": coords}

    def snap_to_road(self, lon, lat):
        graph = self.graph
        x, y = self.to_xy(lon, lat)
        dist = np.hypot(graph["coords"][:, 0] - x, graph["coords"][:, 1] - y)
        index = int(np.argmin(dist))
        return int(graph["valid"][index]), float(dist[index])


def _classify_service(tags):
    amenity = tags.get("amenity")
    if amenity == "hospital" or tags.get("healthcare") == "hospital":
        return "hospital"
    if amenity in ("clinic", "doctors"):
        return "clinic"
    if amenity == "fire_station":
        return "fire_station"
    if amenity == "police":
        return "police"
    if tags.get("leisure") in ("pitch", "park", "stadium"):
        return "open_area"
    return None


# ------------------------------------------------------------------
# Scene construction
# ------------------------------------------------------------------

def _ring_of(geometry):
    coords = geometry["coordinates"]
    return coords[0] if geometry["type"] == "Polygon" else coords[0][0]


def _polygon_area_centroid(ring):
    """Area (m2) and centroid (lon, lat) of a ring, locally projected."""
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110574.0
    pts = [(lon * kx, lat * ky) for lon, lat in ring]
    area2 = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cross = x0 * y1 - x1 * y0
        area2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(area2) < 1e-9:
        return 0.0, (sum(p[0] for p in ring) / len(ring), lat0)
    return abs(area2) / 2, (cx / (3 * area2) / kx, cy / (3 * area2) / ky)


@lru_cache(maxsize=1)
def load_case_scene():
    with open(BUILDINGS_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    buildings = []
    for feature in data["features"]:
        props = feature["properties"]
        area, (lon, lat) = _polygon_area_centroid(_ring_of(feature["geometry"]))
        buildings.append({
            "id": str(props.get("building_id")),
            "damage": props.get("damage", "no-damage"),
            "damage_class": int(props.get("damage_class", 0)),
            "confidence": float(props.get("confidence") or 0.0),
            "area_m2": area,
            "lon": lon,
            "lat": lat,
        })

    with open(ROADS_FILE, "r", encoding="utf-8") as file:
        roads = json.load(file)["elements"]
    with open(SERVICES_FILE, "r", encoding="utf-8") as file:
        services = json.load(file)["elements"]

    return Scene("Caraballeda, Venezuela", buildings, roads, services)


_CLASS_IDS = {"no-damage": 0, "minor-damage": 1, "major-damage": 2,
              "destroyed": 3}


def scene_from_damage_geojson(damage_geojson, roads, services,
                              name="Uploaded imagery"):
    """Build a scene from Model 2 damage regions (see model2_geospatial)."""
    buildings = []
    for index, feature in enumerate(damage_geojson["features"]):
        props = feature["properties"]
        damage = props.get("damage_class")
        if damage not in _CLASS_IDS:
            continue
        area, (lon, lat) = _polygon_area_centroid(_ring_of(feature["geometry"]))
        buildings.append({
            "id": f"R{index}",
            "damage": damage,
            "damage_class": _CLASS_IDS[damage],
            "confidence": 0.0,
            "area_m2": area,
            "lon": lon,
            "lat": lat,
        })
    return Scene(name, buildings, roads, services,
                 unit="damage regions", is_region_based=True)


# ------------------------------------------------------------------
# Routing
# ------------------------------------------------------------------

def shortest_paths(graph, source):
    """Dijkstra (seconds) from source. Returns (time, previous-edge)."""
    time = {source: 0.0}
    previous = {}
    heap = [(0.0, source)]
    while heap:
        cost, node = heapq.heappop(heap)
        if cost > time.get(node, math.inf):
            continue
        for neighbour, edge in graph["adjacency"][node]:
            new_cost = cost + edge["seconds"]
            if new_cost < time.get(neighbour, math.inf):
                time[neighbour] = new_cost
                previous[neighbour] = (node, edge)
                heapq.heappush(heap, (new_cost, neighbour))
    return time, previous


def reconstruct(graph, previous, source, target):
    path = [target]
    length = 0.0
    debris_segments = 0
    node = target
    while node != source:
        node, edge = previous[node]
        length += edge["length"]
        debris_segments += 1 if edge["debris"] else 0
        path.append(node)
    path.reverse()
    polyline = [[graph["nodes"][n][1], graph["nodes"][n][0]] for n in path]
    return polyline, length, debris_segments


def _pick_base(scene, base_id, bounds=None):
    facilities = scene.facilities
    if base_id:
        for item in facilities:
            if item["id"] == base_id:
                return item
    for kind in ("fire_station", "police", "hospital", "clinic"):
        match = [f for f in facilities if f["type"] == kind]
        if match:
            return match[0]
    # no known facility: stage at the south-west corner of the scene
    if bounds:
        lon, lat = bounds["west"], bounds["south"]
    else:
        lon = min(b["lon"] for b in scene.buildings)
        lat = min(b["lat"] for b in scene.buildings)
    return {"id": "staging", "type": "fire_station",
            "name": "Staging point (no facility found)", "lat": lat, "lon": lon}


# ------------------------------------------------------------------
# Plan
# ------------------------------------------------------------------

def build_plan(scene=None, teams=3, time_of_day="night", top_zones=12,
               base_id=None, bounds=None):
    scene = scene or load_case_scene()
    teams = max(1, min(int(teams), 8))
    top_zones = max(1, min(int(top_zones), 40))

    zones = scene.build_zones(time_of_day)
    targets = zones[:top_zones]
    base = _pick_base(scene, base_id, bounds)
    graph = scene.graph
    notes = []
    routes = []

    if graph is None or not targets:
        notes.append(
            "No road data was found for this area, so only priority zones "
            "are shown." if graph is None else "No damaged areas detected."
        )
    else:
        base_node, _ = scene.snap_to_road(base["lon"], base["lat"])

        hospital_nodes = [
            (h, scene.snap_to_road(h["lon"], h["lat"])[0])
            for h in scene.facilities if h["type"] in ("hospital", "clinic")
        ]
        for zone in targets:
            zone["node"], _ = scene.snap_to_road(zone["lon"], zone["lat"])

        cache = {}

        def paths_from(node):
            if node not in cache:
                cache[node] = shortest_paths(graph, node)
            return cache[node]

        fleet = [{
            "team": f"Team {chr(65 + i)}", "node": base_node, "clock_min": 0.0,
            "stops": [], "distance_m": 0.0, "legs": [], "debris_segments": 0,
        } for i in range(teams)]

        # Greedy: most urgent zone first, to the team that arrives soonest
        for zone in targets:
            best = None
            for team in fleet:
                time_map, _ = paths_from(team["node"])
                if zone["node"] not in time_map:
                    continue
                arrival = team["clock_min"] + time_map[zone["node"]] / 60
                if best is None or arrival < best[0]:
                    best = (arrival, team)
            if best is None:
                continue
            arrival, team = best
            _, previous = paths_from(team["node"])
            polyline, length, debris = reconstruct(
                graph, previous, team["node"], zone["node"]
            )
            dwell = min(15 + 3 * zone["est_trapped"], 120)
            team["stops"].append({
                "zone_id": zone["id"], "rank": zone["rank"],
                "tier": zone["tier"], "arrival_min": round(arrival, 1),
                "work_min": round(dwell), "leg_distance_m": round(length),
                "debris_segments": debris, "est_trapped": zone["est_trapped"],
            })
            team["legs"].append(polyline)
            team["distance_m"] += length
            team["debris_segments"] += debris
            team["clock_min"] = arrival + dwell
            team["node"] = zone["node"]

        # nearest medical facility per routed zone
        for zone in targets:
            time_map, previous = paths_from(zone["node"])
            options = [(time_map[n], h, n) for h, n in hospital_nodes
                       if n in time_map]
            if options:
                seconds, hospital, node = min(options, key=lambda o: o[0])
                _, length, _ = reconstruct(graph, previous, zone["node"], node)
                zone["nearest_medical"] = {
                    "name": hospital["name"], "type": hospital["type"],
                    "distance_m": round(length),
                    "eta_min": round(seconds / 60, 1),
                }

        for team in fleet:
            if team["stops"]:
                routes.append({
                    "team": team["team"], "stops": team["stops"],
                    "total_distance_km": round(team["distance_m"] / 1000, 2),
                    "finish_min": round(team["clock_min"]),
                    "debris_segments": team["debris_segments"],
                    "legs": team["legs"],
                })

    for zone in zones:
        zone.pop("node", None)
        zone.setdefault("nearest_medical", None)

    return {
        "case": scene.name,
        "unit": scene.unit,
        "base": base,
        "teams": teams,
        "notes": notes,
        "assumptions": {
            "floors": FLOORS_ASSUMED,
            "m2_per_person": M2_PER_PERSON,
            "trapped_fraction": TRAPPED_FRACTION,
            "displaced_fraction": DISPLACED_FRACTION,
            "occupancy_by_time": OCCUPANCY_BY_TIME,
            "debris_penalty": DEBRIS_PENALTY,
            "region_built_share": REGION_BUILT_SHARE if scene.is_region_based else None,
            "routing_note": (
                "Routes follow OpenStreetMap roads. Segments within "
                f"{int(DEBRIS_RADIUS_M)} m of a major/destroyed area "
                f"are treated as {DEBRIS_PENALTY}x slower (debris risk)."
            ),
        },
        "impact": scene.impact_summary(time_of_day),
        "zones": zones,
        "routed_zone_count": len(targets),
        "routes": routes,
        "facilities": scene.facilities,
    }
