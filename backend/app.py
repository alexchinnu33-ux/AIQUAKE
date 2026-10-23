import os
import tempfile

from pathlib import Path
from fastapi.responses import FileResponse

from fastapi import UploadFile, File
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine

import models

from auth import router as auth_router
from routes import router as prediction_router
from model2_service import analyze_damage
from model2_geospatial import decode_mask, damage_mask_to_geojson
from rescue_routes import router as rescue_router
from history_routes import router as history_router
from earthquake_routes import router as earthquake_intel_router
from model_routes import router as model_router
from incident_routes import router as incident_router
from region_routes import router as region_router

# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(
    bind=engine
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="GROUNDTRUTH AIQuake API",
    description="AI-powered earthquake damage assessment and rescue routing API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"]
)


# ============================================================
# ROUTES
# ============================================================

app.include_router(
    auth_router
)

app.include_router(
    prediction_router
)

app.include_router(rescue_router)
app.include_router(history_router)
app.include_router(model_router)
app.include_router(incident_router)
app.include_router(region_router)
app.include_router(earthquake_intel_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "GROUNDTRUTH AIQuake API is running"
    }

# ============================================================
# GIS - BUILDING DAMAGE DATA
# ============================================================

import json
from pathlib import Path


GIS_BUILDING_FILE = (
    Path(__file__).resolve().parent.parent
    / "gis"
    / "venezuela"
    / "caraballeda"
    / "output"
    / "caraballeda_building_damage.geojson"
)


@app.get("/gis/buildings")
def get_building_damage():
    if not GIS_BUILDING_FILE.exists():
        return {
            "error": "Building damage GeoJSON file not found",
            "path": str(GIS_BUILDING_FILE)
        }

    with open(GIS_BUILDING_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    import incident
    return incident.apply_to_geojson(data)
@app.post("/predict-damage")
async def predict_damage(
    pre_image: UploadFile = File(...),
    post_image: UploadFile = File(...),
):
    """
    Run AIQuake Model 2 building-level damage analysis.

    Requires:
    - pre-disaster image
    - post-disaster image
    """

    pre_suffix = os.path.splitext(pre_image.filename or ".jpg")[1]
    post_suffix = os.path.splitext(post_image.filename or ".jpg")[1]

    pre_temp_path = None
    post_temp_path = None

    try:
        # Create temporary files.
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=pre_suffix,
        ) as pre_file:
            pre_file.write(await pre_image.read())
            pre_temp_path = pre_file.name

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=post_suffix,
        ) as post_file:
            post_file.write(await post_image.read())
            post_temp_path = post_file.name

        # Run Model 2.
        result = analyze_damage(
            pre_temp_path,
            post_temp_path,
        )

        return {
            "success": True,
            "result": result,
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error),
        }

    finally:
        # Remove temporary uploaded files.
        if pre_temp_path and os.path.exists(pre_temp_path):
            os.remove(pre_temp_path)

        if post_temp_path and os.path.exists(post_temp_path):
            os.remove(post_temp_path)

            # ============================================================
# REAL EARTHQUAKE SAMPLE DATA
# ============================================================

REAL_SAMPLES_DIR = (
    Path(__file__).resolve().parent.parent
    / "ai"
    / "model2"
    / "real_samples"
)


@app.get("/real-data/{file_path:path}")
def get_real_earthquake_file(file_path: str):
    """
    Serve real earthquake sample files generated by
    build_real_earthquake_samples.py.
    """

    requested_file = (REAL_SAMPLES_DIR / file_path).resolve()

    # Security: prevent access outside real_samples
    if REAL_SAMPLES_DIR.resolve() not in requested_file.parents:
        return {"error": "Invalid file path"}

    if not requested_file.exists() or not requested_file.is_file():
        return {
            "error": "Real earthquake file not found",
            "path": str(requested_file),
        }

    return FileResponse(requested_file)

@app.post("/predict-damage-geospatial")
async def predict_damage_geospatial(
    pre_image: UploadFile = File(...),
    post_image: UploadFile = File(...),

    west: float = Form(...),
    south: float = Form(...),
    east: float = Form(...),
    north: float = Form(...),
):
    """
    Run Model 2 and convert its predicted damage mask
    into geographic GeoJSON.

    The geographic bounds MUST correspond to the
    actual post-event image being analyzed.
    """

    pre_suffix = os.path.splitext(
        pre_image.filename or ".jpg"
    )[1]

    post_suffix = os.path.splitext(
        post_image.filename or ".jpg"
    )[1]

    pre_temp_path = None
    post_temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=pre_suffix,
        ) as pre_file:

            pre_file.write(
                await pre_image.read()
            )

            pre_temp_path = pre_file.name

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=post_suffix,
        ) as post_file:

            post_file.write(
                await post_image.read()
            )

            post_temp_path = post_file.name

        result = analyze_damage(
            pre_temp_path,
            post_temp_path,
        )

        mask = decode_mask(
            result["damage_mask_png"]
        )

        bounds = {
            "west": west,
            "south": south,
            "east": east,
            "north": north,
        }

        if west >= east:
            raise ValueError(
                "Invalid geographic bounds: west must be less than east."
            )

        if south >= north:
            raise ValueError(
                "Invalid geographic bounds: south must be less than north."
            )

        geojson = damage_mask_to_geojson(
            mask,
            bounds,
            minimum_area_pixels=10,
        )

        return {
            "success": True,

            "model": "AIQuake Model 2",

            "image_size": {
                "width": int(mask.shape[1]),
                "height": int(mask.shape[0]),
            },

            "geographic_bounds": bounds,

            "damage_counts": result[
                "damage_counts"
            ],

            "damage_percentages": result[
                "damage_percentages"
            ],

            "damage_geojson": geojson,

            "feature_count": len(
                geojson["features"]
            ),
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error),
        }

    finally:
        if (
            pre_temp_path
            and os.path.exists(pre_temp_path)
        ):
            os.remove(pre_temp_path)

        if (
            post_temp_path
            and os.path.exists(post_temp_path)
        ):
            os.remove(post_temp_path)