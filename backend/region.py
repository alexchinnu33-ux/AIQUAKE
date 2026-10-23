"""
Region intelligence for ANY place in the world.

Free, key-less public data sources:
  * Nominatim (OpenStreetMap)  - place search / reverse geocoding
  * USGS Earthquake Catalog    - past earthquakes, event details
  * USGS ShakeMap + PAGER      - measured/modelled shaking (MMI) grids, population
                                 exposure and estimated fatalities
  * OpenStreetMap Overpass     - buildings, roads, hospitals, fire stations ...
  * Open-Meteo                 - current weather

IMPORTANT: earthquakes cannot be predicted in time. The "risk estimate" below is
a statistical summary of the past rate of earthquakes near the location.
The damage scenario is a MODEL (ShakeMap shaking + generic fragility), not an
observation.
"""

import csv
import hashlib
import io
import json
import math
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import rescue

UA = "AIQuake-capstone/1.0 (student project)"
DATA = Path(__file__).resolve().parent / "data"
SHAKE_CACHE = DATA / "shake_cache"
OSM_CACHE = DATA / "osm_cache"

USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query"
NOMINATIM = "https://nominatim.openstreetmap.org"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)


class UpstreamError(RuntimeError):
    """An external data service could not be reached."""


# ------------------------------------------------------------------
# HTTP helpers with a small in-memory TTL cache
# ------------------------------------------------------------------

_cache = {}


def _get(url, params=None, timeout=30, ttl=600, as_json=True):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
    except Exception as error:
        raise UpstreamError(f"{urllib.parse.urlparse(url).netloc} unavailable: {error}")
    value = json.loads(body) if as_json else body
    _cache[url] = (time.time(), value)
    return value


def _overpass(query, cache_key=None, timeout=90):
    cache_file = None
    if cache_key:
        OSM_CACHE.mkdir(parents=True, exist_ok=True)
        cache_file = OSM_CACHE / f"{hashlib.sha1(cache_key.encode()).hexdigest()[:16]}.json"
        if cache_file.exists():
            return json.loads(cache_file.read_text(encoding="utf-8"))

    last = None
    for attempt in range(3):                  # public servers are often busy
        for url in OVERPASS:
            try:
                request = urllib.request.Request(
                    url,
                    data=urllib.parse.urlencode({"data": query}).encode(),
                    headers={"User-Agent": UA, "Accept": "application/json"},
                )
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    elements = json.load(response)["elements"]
                if cache_file:
                    cache_file.write_text(json.dumps(elements), encoding="utf-8")
                return elements
            except Exception as error:
                last = error
        time.sleep(4 * (attempt + 1))
    raise UpstreamError(f"OpenStreetMap (Overpass) unavailable: {last}")


# ------------------------------------------------------------------
# Places
# ------------------------------------------------------------------

def geocode(query, limit=6):
    rows = _get(
        f"{NOMINATIM}/search",
        {"q": query, "format": "jsonv2", "limit": limit, "addressdetails": 1},
        ttl=3600,
    )
    return [{
        "name": row["display_name"],
        "lat": float(row["lat"]),
        "lon": float(row["lon"]),
        "country_code": (row.get("address", {}).get("country_code") or "").upper(),
    } for row in rows]


def reverse_geocode(lat, lon):
    try:
        row = _get(
            f"{NOMINATIM}/reverse",
            {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10},
            ttl=3600,
        )
    except UpstreamError:
        return {"name": f"{lat:.3f}, {lon:.3f}", "country_code": ""}
    return {
        "name": row.get("display_name", f"{lat:.3f}, {lon:.3f}"),
        "country_code": (row.get("address", {}).get("country_code") or "").upper(),
    }


# ------------------------------------------------------------------
# Seismic history and statistical risk estimate
# ------------------------------------------------------------------

def _haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(a))


def seismic_history(lat, lon, radius_km=300, years=50, min_magnitude=4.5):
    start = (datetime.now(timezone.utc) - timedelta(days=365.25 * years)).date()
    raw = _get(
        USGS,
        {"format": "csv", "latitude": lat, "longitude": lon,
         "maxradiuskm": radius_km, "starttime": start.isoformat(),
         "minmagnitude": min_magnitude, "orderby": "time", "limit": 20000},
        timeout=60, ttl=900, as_json=False,
    ).decode("utf-8")

    events = []
    for row in csv.DictReader(io.StringIO(raw)):
        try:
            mag = float(row["mag"])
        except (TypeError, ValueError):
            continue
        events.append({
            "id": row["id"],
            "time": row["time"],
            "year": int(row["time"][:4]),
            "magnitude": mag,
            "mag_type": row["magType"],
            "depth_km": float(row["depth"]) if row["depth"] else None,
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "place": row["place"],
            "distance_km": round(_haversine_km(lat, lon, float(row["latitude"]),
                                               float(row["longitude"]))),
        })

    return events, _risk_stats(events, years, min_magnitude, radius_km)


def _risk_stats(events, years, min_mag, radius_km):
    n = len(events)
    if n == 0:
        return {"events": 0, "years": years, "min_magnitude": min_mag,
                "radius_km": radius_km, "hazard_level": "Low",
                "note": "No earthquakes of this size recorded in the search area."}

    mags = np.array([e["magnitude"] for e in events])

    # Aki (1965) maximum-likelihood b-value, with bin-width correction (0.1)
    b_value = None
    if n >= 50:
        b_value = round(math.log10(math.e) / (mags.mean() - (min_mag - 0.05)), 2)
    b_used = b_value if b_value and 0.5 <= b_value <= 1.6 else 1.0

    annual_at_min = n / years
    def rate(m):                                    # events / year with M >= m
        return annual_at_min * 10 ** (-b_used * (m - min_mag))

    def prob(m, horizon):
        return round(1 - math.exp(-rate(m) * horizon), 4)

    r6 = rate(6.0)
    if r6 >= 1:
        level = "Very high"
    elif r6 >= 0.2:
        level = "High"
    elif r6 >= 0.05:
        level = "Moderate"
    else:
        level = "Low"

    per_year = {}
    for e in events:
        per_year[e["year"]] = per_year.get(e["year"], 0) + 1

    biggest = max(events, key=lambda e: e["magnitude"])
    bands = [("4.5-4.9", 4.5, 5.0), ("5.0-5.9", 5.0, 6.0),
             ("6.0-6.9", 6.0, 7.0), ("7.0+", 7.0, 99)]

    return {
        "events": n,
        "years": years,
        "min_magnitude": min_mag,
        "radius_km": radius_km,
        "b_value": b_value,
        "hazard_level": level,
        "events_per_year": round(annual_at_min, 2),
        "annual_rate": {f"M{m}+": round(rate(m), 3) for m in (5, 6, 7)},
        "probability_10y": {f"M{m}+": prob(m, 10) for m in (5, 6, 7)},
        "largest": {"magnitude": biggest["magnitude"], "place": biggest["place"],
                    "year": biggest["year"]},
        "bands": [{"band": label, "count": int(((mags >= lo) & (mags < hi)).sum())}
                  for label, lo, hi in bands],
        "per_year": [{"year": y, "count": c} for y, c in sorted(per_year.items())],
        "note": ("Statistical estimate from the past rate of earthquakes in this "
                 "area (Gutenberg-Richter, Poisson). Earthquakes cannot be "
                 "predicted in time."),
    }


# ------------------------------------------------------------------
# Single earthquake: USGS details, PAGER, ShakeMap
# ------------------------------------------------------------------

def event_detail(event_id):
    data = _get(USGS, {"eventid": event_id, "format": "geojson"}, ttl=3600)
    props = data["properties"]
    lon, lat, depth = data["geometry"]["coordinates"][:3]
    when = datetime.fromtimestamp(props["time"] / 1000, tz=timezone.utc)
    products = props.get("products", {})

    out = {
        "id": event_id,
        "title": props.get("title"),
        "place": props.get("place"),
        "time": when.isoformat(timespec="minutes"),
        "year": when.year,
        "magnitude": props.get("mag"),
        "mag_type": props.get("magType"),
        "depth_km": depth,
        "latitude": lat,
        "longitude": lon,
        "tsunami": bool(props.get("tsunami")),
        "felt_reports": props.get("felt"),
        "max_intensity_reported": props.get("cdi"),
        "max_intensity_modelled": props.get("mmi"),
        "significance": props.get("sig"),
        "usgs_alert": props.get("alert"),
        "url": props.get("url"),
        "has_shakemap": "shakemap" in products,
        "pager": None,
    }

    if "losspager" in products:
        contents = products["losspager"][0]["contents"]
        pager = {"alert_level": products["losspager"][0]["properties"].get("alertlevel")}
        try:
            exposure = _get(contents["json/exposures.json"]["url"], ttl=3600)["population_exposure"]
            pager["population_by_mmi"] = [
                {"mmi": m, "people": p}
                for m, p in zip(exposure["mmi"], exposure["aggregated_exposure"]) if p
            ]
        except (KeyError, UpstreamError):
            pass
        try:
            alerts = _get(contents["json/alerts.json"]["url"], ttl=3600)
            pager["fatality_alert"] = alerts.get("fatality", {}).get("level")
            pager["economic_alert"] = alerts.get("economic", {}).get("level")
            pager["fatality_probabilities"] = [
                {"range": f"{b['min']}-{b['max']}", "probability": round(b["probability"], 3)}
                for b in alerts.get("fatality", {}).get("bins", [])
            ]
        except (KeyError, UpstreamError):
            pass
        out["pager"] = pager
    return out


def _shake_grid(event_id):
    """MMI grid for an event as (array[nlat, nlon], lon_min, lat_max, dx, dy)."""
    SHAKE_CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = SHAKE_CACHE / f"{event_id}.npz"
    if cache_file.exists():
        z = np.load(cache_file)
        return z["mmi"], float(z["lon_min"]), float(z["lat_max"]), float(z["dx"]), float(z["dy"])

    data = _get(USGS, {"eventid": event_id, "format": "geojson"}, ttl=3600)
    products = data["properties"].get("products", {})
    if "shakemap" not in products:
        raise LookupError("USGS has no ShakeMap for this earthquake.")

    url = products["shakemap"][0]["contents"]["download/grid.xml"]["url"]
    text = _get(url, timeout=120, ttl=3600, as_json=False).decode("utf-8")

    fields = text.count("<grid_field ")
    start = text.index("<grid_data>") + len("<grid_data>")
    end = text.index("</grid_data>")
    arr = np.fromstring(text[start:end], sep=" ").reshape(-1, fields)
    lon, lat, mmi_col = arr[:, 0], arr[:, 1], arr[:, 2]

    dx = float(np.diff(np.unique(np.round(lon, 5)))[0])
    dy = float(np.diff(np.unique(np.round(lat, 5)))[0])
    lon_min, lat_max = float(lon.min()), float(lat.max())
    nlon = int(round((lon.max() - lon_min) / dx)) + 1
    nlat = int(round((lat_max - lat.min()) / dy)) + 1
    grid = np.zeros((nlat, nlon), dtype=np.float32)
    ix = np.rint((lon - lon_min) / dx).astype(int)
    iy = np.rint((lat_max - lat) / dy).astype(int)
    grid[iy, ix] = mmi_col

    np.savez_compressed(cache_file, mmi=grid, lon_min=lon_min,
                        lat_max=lat_max, dx=dx, dy=dy)
    return grid, lon_min, lat_max, dx, dy


def mmi_at(grid_info, lon, lat):
    grid, lon_min, lat_max, dx, dy = grid_info
    ix = int(round((lon - lon_min) / dx))
    iy = int(round((lat_max - lat) / dy))
    if 0 <= iy < grid.shape[0] and 0 <= ix < grid.shape[1]:
        return float(grid[iy, ix])
    return 0.0


# ------------------------------------------------------------------
# Emergency support around a location
# ------------------------------------------------------------------

SUPPORT_TYPES = {
    "hospital": "Hospital",
    "clinic": "Clinic",
    "fire_station": "Fire station",
    "police": "Police",
    "helipad": "Helipad / airfield",
    "assembly_point": "Assembly point",
    "shelter": "Shelter",
}


def _support_kind(tags):
    amenity = tags.get("amenity")
    if amenity == "hospital" or tags.get("healthcare") == "hospital":
        return "hospital"
    if amenity in ("clinic", "doctors"):
        return "clinic"
    if amenity == "fire_station":
        return "fire_station"
    if amenity == "police":
        return "police"
    if tags.get("aeroway") in ("helipad", "aerodrome", "heliport"):
        return "helipad"
    if tags.get("emergency") == "assembly_point":
        return "assembly_point"
    if amenity == "shelter" or tags.get("emergency") == "shelter":
        return "shelter"
    return None


def emergency_support(lat, lon, radius_m=15000, per_type=4):
    r = int(radius_m)
    query = (
        f"[out:json][timeout:60];("
        f'nwr["amenity"~"^(hospital|clinic|fire_station|police|shelter)$"](around:{r},{lat},{lon});'
        f'nwr["healthcare"="hospital"](around:{r},{lat},{lon});'
        f'nwr["aeroway"~"^(helipad|heliport|aerodrome)$"](around:{r},{lat},{lon});'
        f'nwr["emergency"~"^(assembly_point|shelter)$"](around:{r},{lat},{lon});'
        ");out center tags;"
    )
    elements = _overpass(query, cache_key=f"support|{lat:.3f}|{lon:.3f}|{r}")

    found = {}
    for element in elements:
        tags = element.get("tags", {})
        kind = _support_kind(tags)
        e_lat = element.get("lat") or element.get("center", {}).get("lat")
        e_lon = element.get("lon") or element.get("center", {}).get("lon")
        if not kind or e_lat is None:
            continue
        found.setdefault(kind, []).append({
            "name": tags.get("name") or SUPPORT_TYPES[kind],
            "lat": e_lat,
            "lon": e_lon,
            "distance_km": round(_haversine_km(lat, lon, e_lat, e_lon), 1),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "emergency": tags.get("emergency") == "yes" or None,
            "beds": tags.get("beds"),
        })

    result = {}
    for kind, items in found.items():
        items.sort(key=lambda i: i["distance_km"])
        result[kind] = {"label": SUPPORT_TYPES[kind], "count": len(items),
                        "nearest": items[:per_type]}
    return result


def weather(lat, lon):
    try:
        data = _get(
            "https://api.open-meteo.com/v1/forecast",
            {"latitude": lat, "longitude": lon,
             "current": "temperature_2m,precipitation,wind_speed_10m,weather_code",
             "daily": "precipitation_sum,temperature_2m_min", "forecast_days": 2,
             "timezone": "auto"},
            ttl=900,
        )
    except UpstreamError:
        return None
    current = data.get("current", {})
    daily = data.get("daily", {})
    return {
        "temperature_c": current.get("temperature_2m"),
        "wind_kmh": current.get("wind_speed_10m"),
        "precipitation_mm": current.get("precipitation"),
        "rain_next_48h_mm": round(sum(daily.get("precipitation_sum", [0]) or [0]), 1),
        "min_temperature_c": min(daily.get("temperature_2m_min", [None]) or [None]),
    }


# ------------------------------------------------------------------
# Modelled damage scenario
# ------------------------------------------------------------------

# Generic damage-state probabilities by MMI (minor, major, destroyed).
# Illustrative low-rise mixed masonry / concrete stock; NOT locally calibrated.
FRAGILITY = {
    5.0: (0.00, 0.000, 0.000),
    6.0: (0.05, 0.002, 0.000),
    7.0: (0.25, 0.030, 0.003),
    8.0: (0.40, 0.150, 0.030),
    9.0: (0.35, 0.350, 0.150),
    10.0: (0.15, 0.400, 0.400),
}


def damage_probabilities(mmi):
    keys = sorted(FRAGILITY)
    if mmi <= keys[0]:
        return FRAGILITY[keys[0]]
    if mmi >= keys[-1]:
        return FRAGILITY[keys[-1]]
    for lo, hi in zip(keys, keys[1:]):
        if lo <= mmi <= hi:
            t = (mmi - lo) / (hi - lo)
            return tuple(a + t * (b - a) for a, b in zip(FRAGILITY[lo], FRAGILITY[hi]))


def _stable_uniform(key):
    digest = hashlib.sha1(str(key).encode()).digest()
    return int.from_bytes(digest[:4], "big") / 2 ** 32


def _classify(mmi, key):
    minor, major, destroyed = damage_probabilities(mmi)
    u = _stable_uniform(key)
    if u < destroyed:
        return "destroyed", 3
    if u < destroyed + major:
        return "major-damage", 2
    if u < destroyed + major + minor:
        return "minor-damage", 1
    return "no-damage", 0


def fetch_buildings(bounds):
    query = (
        f'[out:json][timeout:90];way["building"]'
        f'({bounds["south"]:.5f},{bounds["west"]:.5f},{bounds["north"]:.5f},{bounds["east"]:.5f});'
        "out ids bb;"
    )
    return _overpass(query, cache_key=f"buildings|{json.dumps(bounds, sort_keys=True)}", timeout=120)


def build_scenario_scene(event_id, lat, lon, half_size_deg=0.01):
    grid = _shake_grid(event_id)
    bounds = {"west": lon - half_size_deg, "south": lat - half_size_deg,
              "east": lon + half_size_deg, "north": lat + half_size_deg}

    from concurrent.futures import ThreadPoolExecutor
    from osm_fetch import fetch_osm

    def safe_roads():
        try:
            return fetch_osm(bounds)
        except Exception:
            return [], []          # plan still works without roads (zones only)

    with ThreadPoolExecutor(max_workers=2) as pool:
        roads_job = pool.submit(safe_roads)
        elements = fetch_buildings(bounds)
        roads, services = roads_job.result()

    if not elements:
        raise LookupError(
            "OpenStreetMap has no mapped buildings here. Pick a town or city centre."
        )

    kx = 111320.0 * math.cos(math.radians(lat))
    ky = 110574.0
    buildings = []
    shaking = []
    for element in elements:
        b = element.get("bounds")
        if not b:
            continue
        w = (b["maxlon"] - b["minlon"]) * kx
        h = (b["maxlat"] - b["minlat"]) * ky
        area = max(w * h * 0.7, 10.0)          # bbox of a footprint ~70 % filled
        c_lon = (b["minlon"] + b["maxlon"]) / 2
        c_lat = (b["minlat"] + b["maxlat"]) / 2
        mmi = mmi_at(grid, c_lon, c_lat)
        damage, damage_class = _classify(mmi, element["id"])
        shaking.append(mmi)
        buildings.append({
            "id": str(element["id"]), "damage": damage, "damage_class": damage_class,
            "confidence": 0.0, "area_m2": area, "lon": c_lon, "lat": c_lat,
            "mmi": mmi,
            "box": [b["minlon"], b["minlat"], b["maxlon"], b["maxlat"]],
        })

    scene = rescue.Scene("Modelled scenario", buildings, roads, services,
                         unit="buildings (modelled)")
    return scene, bounds, shaking


def damage_geojson_for(scene):
    features = []
    for b in scene.buildings:
        if b["damage_class"] < 1:
            continue
        x0, y0, x1, y1 = b["box"]
        features.append({
            "type": "Feature",
            "properties": {"damage_class": b["damage"], "mmi": round(b["mmi"], 1)},
            "geometry": {"type": "Polygon",
                         "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]},
        })
    return {"type": "FeatureCollection", "features": features}


# ------------------------------------------------------------------
# Live feed (public landing page)
# ------------------------------------------------------------------

FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{}.geojson"


def live_quakes():
    """Earthquakes M4.5+ of the last 24 h and last 7 days (USGS feeds)."""
    day = _get(FEED.format("4.5_day"), ttl=300)["features"]
    week = _get(FEED.format("4.5_week"), ttl=300)["features"]

    def simplify(feature):
        props = feature["properties"]
        lon, lat, depth = feature["geometry"]["coordinates"][:3]
        return {
            "id": feature["id"],
            "magnitude": props.get("mag"),
            "place": props.get("place"),
            "time": datetime.fromtimestamp(props["time"] / 1000, tz=timezone.utc)
                    .isoformat(timespec="minutes"),
            "latitude": lat,
            "longitude": lon,
            "depth_km": depth,
            "tsunami": bool(props.get("tsunami")),
            "alert": props.get("alert"),
        }

    events = sorted((simplify(f) for f in day), key=lambda e: e["time"], reverse=True)
    strongest = max((simplify(f) for f in week), key=lambda e: e["magnitude"] or 0, default=None)
    return {
        "last_24h": len(day),
        "last_7d": len(week),
        "strongest_7d": strongest,
        "events": events[:60],
        "source": "USGS real-time feeds (M4.5+)",
    }
