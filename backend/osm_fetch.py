"""Fetch (and cache) OpenStreetMap roads and emergency facilities for a bbox."""

import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parent / "data" / "osm_cache"
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
MAX_SPAN_DEG = 0.12   # ~13 km: keeps Overpass queries small and fast
PAD_DEG = 0.002

HIGHWAYS = (
    "motorway|trunk|primary|secondary|tertiary|unclassified|residential|"
    "service|living_street|motorway_link|trunk_link|primary_link|"
    "secondary_link|tertiary_link"
)


def _query(body):
    last_error = None
    for url in OVERPASS_URLS:
        try:
            request = urllib.request.Request(
                url,
                data=urllib.parse.urlencode({"data": body}).encode(),
                headers={"User-Agent": "AIQuake-capstone/1.0",
                         "Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)["elements"]
        except Exception as error:  # network / overpass overload
            last_error = error
    raise ConnectionError(f"OpenStreetMap (Overpass) unavailable: {last_error}")


def fetch_osm(bounds):
    """Return (road ways with geometry, facility elements) inside bounds."""
    west, south = bounds["west"] - PAD_DEG, bounds["south"] - PAD_DEG
    east, north = bounds["east"] + PAD_DEG, bounds["north"] + PAD_DEG

    if east - west > MAX_SPAN_DEG or north - south > MAX_SPAN_DEG:
        raise ValueError(
            f"Area too large: keep each side under {MAX_SPAN_DEG} degrees "
            "(about 13 km)."
        )

    bbox = f"{south:.5f},{west:.5f},{north:.5f},{east:.5f}"
    key = hashlib.sha1(bbox.encode()).hexdigest()[:16]
    cache_file = CACHE_DIR / f"{key}.json"

    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        return data["roads"], data["services"]

    roads = _query(
        f'[out:json][timeout:60];way["highway"~"^({HIGHWAYS})$"]({bbox});'
        "out geom;"
    )
    services = _query(
        '[out:json][timeout:60];('
        f'nwr["amenity"~"^(hospital|clinic|fire_station|police|doctors)$"]({bbox});'
        f'nwr["healthcare"="hospital"]({bbox});'
        f'nwr["leisure"~"^(pitch|park|stadium)$"]({bbox});'
        ");out center tags;"
    )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(
        json.dumps({"roads": roads, "services": services}), encoding="utf-8"
    )
    return roads, services
