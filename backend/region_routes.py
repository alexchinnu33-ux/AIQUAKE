from typing import Literal

from fastapi import APIRouter, HTTPException, Query

import region
import rescue


router = APIRouter(prefix="/region", tags=["Region Intelligence"])


def _upstream(error):
    return HTTPException(status_code=503, detail=str(error))


@router.get("/geocode")
def geocode(q: str = Query(..., min_length=2, max_length=120)):
    """Search a place name anywhere in the world."""
    try:
        return region.geocode(q)
    except region.UpstreamError as error:
        raise _upstream(error)


@router.get("/intel")
def region_intel(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_km: int = Query(300, ge=20, le=1000),
    years: int = Query(50, ge=5, le=125),
    min_magnitude: float = Query(4.5, ge=3, le=7),
):
    """Seismic history, statistical risk estimate, emergency support, weather."""
    try:
        events, stats = region.seismic_history(lat, lon, radius_km, years, min_magnitude)
    except region.UpstreamError as error:
        raise _upstream(error)

    place = region.reverse_geocode(lat, lon)

    top = sorted(events, key=lambda e: e["magnitude"], reverse=True)[:80]
    recent_big = [e for e in events if e["magnitude"] >= 6][:5]

    return {
        "location": {"lat": lat, "lon": lon, **place},
        "stats": stats,
        "events": top,
        "recent_significant": recent_big,
        "weather": region.weather(lat, lon),
        "sources": ["USGS Earthquake Catalog", "OpenStreetMap (Overpass, Nominatim)",
                    "Open-Meteo"],
    }


@router.get("/support")
def emergency_support(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_km: int = Query(12, ge=2, le=30),
):
    """Nearest hospitals, fire stations, police, helipads and shelters.

    Can take up to a minute the first time for a large city (cached after).
    """
    try:
        return region.emergency_support(lat, lon, radius_m=radius_km * 1000)
    except region.UpstreamError as error:
        raise _upstream(error)


@router.get("/event/{event_id}")
def event_detail(event_id: str):
    """Magnitude, depth, intensity, PAGER alerts and exposure for one earthquake."""
    try:
        return region.event_detail(event_id)
    except region.UpstreamError as error:
        raise _upstream(error)


@router.get("/scenario")
def modelled_scenario(
    event_id: str,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    teams: int = Query(3, ge=1, le=8),
    time_of_day: Literal["night", "day"] = "night",
    top_zones: int = Query(12, ge=1, le=40),
):
    """
    Modelled damage and rescue plan for the ~2 km area around (lat, lon),
    using the USGS ShakeMap shaking of the chosen earthquake.
    """
    try:
        scene, bounds, shaking = region.build_scenario_scene(event_id, lat, lon)
        plan = rescue.build_plan(
            scene, teams, time_of_day, top_zones, bounds=bounds
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except region.UpstreamError as error:
        raise _upstream(error)

    plan["bounds"] = bounds
    plan["damage_geojson"] = region.damage_geojson_for(scene)
    plan["shaking"] = {
        "mean_mmi": round(sum(shaking) / len(shaking), 1) if shaking else None,
        "max_mmi": round(max(shaking), 1) if shaking else None,
    }
    plan["fragility"] = {str(k): v for k, v in region.FRAGILITY.items()}
    plan["model_note"] = (
        "Not observed: damage is estimated from USGS ShakeMap shaking and a "
        "generic building-vulnerability table. Real damage depends on "
        "construction quality and local soil."
    )
    return plan


@router.get("/live")
def live_quakes():
    """Worldwide earthquakes of the last 24 hours (public, cached 5 minutes)."""
    try:
        return region.live_quakes()
    except region.UpstreamError as error:
        raise _upstream(error)
