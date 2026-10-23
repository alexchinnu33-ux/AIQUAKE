import json
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

import incident
from model import predict_image
from routes import get_current_user


router = APIRouter(prefix="/incident", tags=["Incident"])

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "ai" / "dataset"
METADATA = ROOT / "ai" / "model2" / "real_samples" / "metadata.json"
METRICS = ROOT / "ai" / "models" / "model1_metrics.json"

MAX_PHOTO_BYTES = 10 * 1024 * 1024


@router.get("/info")
def incident_info():
    meta = json.loads(METADATA.read_text(encoding="utf-8")) if METADATA.exists() else {}
    accuracy = None
    if METRICS.exists():
        accuracy = json.loads(METRICS.read_text(encoding="utf-8")).get("accuracy")

    return {
        "name": "2026 Venezuela earthquake",
        "area": meta.get("area", "Caraballeda"),
        "event_date": meta.get("event_date"),
        "damage_source": meta.get("damage_data"),
        "damage_note": meta.get("damage_data_note"),
        "sources": meta.get("sources", []),
        "field_reports": len(incident.list_reports()),
        "model1_accuracy": accuracy,
    }


@router.get("/reports")
def get_reports():
    return incident.list_reports()


@router.post("/report")
def create_report(
    photo: UploadFile = File(...),
    lat: float = Form(..., ge=-90, le=90),
    lon: float = Form(..., ge=-180, le=180),
    _user=Depends(get_current_user),
):
    """Classify a field photo with Model 1 and apply it to the nearest building."""
    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo larger than 10 MB.")

    suffix = os.path.splitext(photo.filename or ".jpg")[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(data)
        path = handle.name

    try:
        try:
            result = predict_image(path)
        except Exception:
            raise HTTPException(status_code=422, detail="That file is not a readable image.")

        try:
            return incident.add_report(
                lat, lon, result["prediction"], float(result["confidence"]),
                photo.filename,
            )
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error))
    finally:
        os.remove(path)


@router.delete("/reports")
def reset_reports(_user=Depends(get_current_user)):
    incident.clear_reports()
    return {"cleared": True}


@router.get("/sample-photo")
def sample_photo(
    label: str = Query(..., pattern="^(Collapsed|Damaged|Intact)$"),
    index: int = Query(0, ge=0),
):
    """A real photo from the training dataset, for trying the pipeline."""
    folder = DATASET / label
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
    if not files:
        raise HTTPException(status_code=404, detail="No sample photos available.")
    return FileResponse(files[index % len(files)])
