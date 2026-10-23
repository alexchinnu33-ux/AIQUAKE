import os
import tempfile
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

import incident
import rescue
from model2_geospatial import damage_mask_to_geojson, decode_mask
from model2_service import analyze_damage
from osm_fetch import fetch_osm


router = APIRouter(prefix="/rescue", tags=["Rescue Planning"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.get("/plan")
def get_rescue_plan(
    teams: int = Query(3, ge=1, le=8),
    time_of_day: Literal["night", "day"] = "night",
    top_zones: int = Query(12, ge=1, le=40),
    base_id: str | None = None,
):
    """Priority zones, population impact and road routes (Caraballeda case)."""
    try:
        return rescue.build_plan(
            incident.current_scene(), teams, time_of_day, top_zones, base_id
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


def _save_upload(upload: UploadFile, paths: list) -> str:
    data = upload.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image larger than 25 MB.")
    suffix = os.path.splitext(upload.filename or ".jpg")[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(data)
        paths.append(handle.name)
        return handle.name


@router.post("/analyze")
def analyze_uploaded_imagery(
    pre_image: UploadFile = File(...),
    post_image: UploadFile = File(...),
    west: float = Form(...),
    south: float = Form(...),
    east: float = Form(...),
    north: float = Form(...),
    teams: int = Form(3, ge=1, le=8),
    time_of_day: Literal["night", "day"] = Form("night"),
    top_zones: int = Form(12, ge=1, le=40),
):
    """
    End-to-end pipeline for any area: pre/post imagery -> Model 2 damage
    regions -> OSM roads & facilities -> impact estimate, priorities, routes.

    The bounds must be the real geographic extent of the post-event image.
    """
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise HTTPException(
            status_code=422,
            detail="Invalid bounds: need west < east and south < north "
                   "within valid longitude/latitude ranges.",
        )
    bounds = {"west": west, "south": south, "east": east, "north": north}

    temp_paths = []
    try:
        pre_path = _save_upload(pre_image, temp_paths)
        post_path = _save_upload(post_image, temp_paths)

        try:
            result = analyze_damage(pre_path, post_path)
        except Exception as error:
            raise HTTPException(
                status_code=422, detail=f"Model 2 could not read the images: {error}"
            )

        mask = decode_mask(result["damage_mask_png"])
        damage_geojson = damage_mask_to_geojson(mask, bounds, minimum_area_pixels=10)

        try:
            roads, services = fetch_osm(bounds)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error))
        except ConnectionError as error:
            raise HTTPException(status_code=503, detail=str(error))

        scene = rescue.scene_from_damage_geojson(
            damage_geojson, roads, services, name="Uploaded imagery"
        )
        plan = rescue.build_plan(
            scene, teams, time_of_day, top_zones, bounds=bounds
        )
        plan["damage_geojson"] = damage_geojson
        plan["bounds"] = bounds
        plan["pixel_damage_percentages"] = result["damage_percentages"]
        return plan
    finally:
        for path in temp_paths:
            if os.path.exists(path):
                os.remove(path)
