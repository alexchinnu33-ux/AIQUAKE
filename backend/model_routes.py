import json
from pathlib import Path

from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/model", tags=["Model Performance"])

METRICS_FILE = (
    Path(__file__).resolve().parent.parent
    / "ai"
    / "models"
    / "model1_metrics.json"
)


@router.get("/metrics")
def model_metrics():
    """Held-out test metrics for Model 1 plus a description of Model 2."""
    if not METRICS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Metrics not generated yet. Run: python ai/training/export_metrics.py",
        )

    with open(METRICS_FILE, "r", encoding="utf-8") as file:
        model1 = json.load(file)

    return {
        "model1": model1,
        "model2": {
            "model": "AIQuake Model 2 (ONNX building-damage segmentation)",
            "input": "pre- and post-event image pair, resized to 512 x 512",
            "output": "per-pixel class: no-damage, minor, major, destroyed",
            "validation_note": (
                "Model 2 was not scored against labelled ground truth in this "
                "project. Its Caraballeda damage labels come from the HOTOSM "
                "fAIr assessment and are candidates for field verification."
            ),
        },
    }
