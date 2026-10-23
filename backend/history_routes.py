import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Query


router = APIRouter(prefix="/earthquakes", tags=["Earthquake History"])

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
ARCHIVE_FILE = Path(__file__).resolve().parent / "data" / "notable_earthquakes.json"


@lru_cache(maxsize=1)
def load_archive():
    with open(ARCHIVE_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _archive_events(start_year, end_year, min_magnitude):
    return [
        dict(event) for event in load_archive()
        if start_year <= event["year"] <= end_year
        and event["magnitude"] >= min_magnitude
    ]


def _live_events(start_year, end_year, min_magnitude, limit):
    params = {
        "format": "geojson",
        "starttime": f"{start_year}-01-01",
        "endtime": f"{end_year}-12-31",
        "minmagnitude": min_magnitude,
        "orderby": "magnitude",
        "limit": limit,
    }
    request = Request(
        f"{USGS_URL}?{urlencode(params)}",
        headers={"User-Agent": "AIQuake-capstone/1.0"},
    )
    with urlopen(request, timeout=12) as response:
        data = json.load(response)

    events = []
    for feature in data.get("features", []):
        props = feature["properties"]
        lon, lat, depth = feature["geometry"]["coordinates"][:3]
        when = datetime.fromtimestamp(props["time"] / 1000, tz=timezone.utc)
        events.append({
            "id": feature["id"],
            "name": props.get("place") or "Unknown location",
            "place": props.get("place"),
            "year": when.year,
            "date": when.date().isoformat(),
            "magnitude": props.get("mag"),
            "latitude": lat,
            "longitude": lon,
            "depth_km": depth,
            "deaths": None,
            "tsunami": bool(props.get("tsunami")),
            "url": props.get("url"),
            "source": "USGS",
        })
    return events


def _attach_known_fatalities(events):
    """Copy name + fatalities from the curated archive for matching events."""
    for event in events:
        for known in load_archive():
            if (
                known["year"] == event["year"]
                and abs(known["latitude"] - event["latitude"]) < 1.5
                and abs(known["longitude"] - event["longitude"]) < 1.5
                and abs(known["magnitude"] - (event["magnitude"] or 0)) < 0.7
            ):
                event["deaths"] = known["deaths"]
                event["name"] = known["name"]
                break


@router.get("/history")
def earthquake_history(
    start_year: int = Query(2000, ge=1900, le=2100),
    end_year: int = Query(datetime.now().year, ge=1900, le=2100),
    min_magnitude: float = Query(7.0, ge=0, le=10),
    limit: int = Query(200, ge=1, le=500),
    source: str = Query("auto", pattern="^(auto|live|archive)$"),
):
    """
    Past earthquakes.

    `live` queries the USGS catalogue, `archive` returns the curated list of
    notable events bundled with AIQuake (works offline, includes fatalities),
    `auto` tries live first and falls back to the archive.
    """
    if start_year > end_year:
        start_year, end_year = end_year, start_year

    events, used, note = [], None, None

    if source in ("auto", "live"):
        try:
            events = _live_events(start_year, end_year, min_magnitude, limit)
            used = "USGS live catalogue"
            _attach_known_fatalities(events)
        except (URLError, TimeoutError, OSError, ValueError) as error:
            note = f"USGS unavailable ({error}); showing the bundled archive."

    if used is None:
        events = _archive_events(start_year, end_year, min_magnitude)
        used = "AIQuake notable earthquakes archive"

    events.sort(key=lambda e: e["magnitude"] or 0, reverse=True)

    by_year = {}
    for event in events:
        by_year[event["year"]] = by_year.get(event["year"], 0) + 1

    return {
        "source": used,
        "note": note,
        "count": len(events),
        "per_year": [{"year": y, "count": c} for y, c in sorted(by_year.items())],
        "events": events,
    }
