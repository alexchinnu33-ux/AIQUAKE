import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import numpy as np
import pytest
from fastapi.testclient import TestClient

import region
from app import app

client = TestClient(app)


def test_fragility_rises_with_shaking():
    destroyed = [region.damage_probabilities(m)[2] for m in (5, 6, 7, 8, 9, 10)]
    assert destroyed == sorted(destroyed)
    assert region.damage_probabilities(4.0) == (0.0, 0.0, 0.0)
    assert sum(region.damage_probabilities(8.5)) < 1


def test_classification_is_deterministic_and_follows_shaking():
    assert region._classify(8.0, "b1") == region._classify(8.0, "b1")
    low = [region._classify(5.0, i)[1] for i in range(500)]
    high = [region._classify(10.0, i)[1] for i in range(500)]
    assert set(low) == {0}
    assert np.mean(high) > 1.0


def test_risk_stats_empty_and_busy_regions():
    empty = region._risk_stats([], 50, 4.5, 300)
    assert empty["hazard_level"] == "Low"

    # 600 events at M4.5-6.4 over 50 years -> high rate of M6+
    events = [{"magnitude": 4.5 + (i % 20) / 10, "year": 1980 + i % 40,
               "place": "x"} for i in range(600)]
    stats = region._risk_stats(events, 50, 4.5, 300)
    assert stats["events"] == 600
    assert 0 < stats["probability_10y"]["M7+"] < stats["probability_10y"]["M6+"] <= 1
    assert stats["annual_rate"]["M5+"] > stats["annual_rate"]["M6+"] > stats["annual_rate"]["M7+"]


def test_mmi_lookup_uses_grid_and_handles_outside():
    grid = np.arange(12, dtype=np.float32).reshape(3, 4)
    info = (grid, 10.0, 20.0, 0.5, 0.5)
    assert region.mmi_at(info, 10.0, 20.0) == 0
    assert region.mmi_at(info, 11.5, 19.0) == 11      # last cell
    assert region.mmi_at(info, 50.0, 50.0) == 0.0     # outside grid


def test_input_validation():
    assert client.get("/region/intel?lat=999&lon=0").status_code == 422
    assert client.get("/region/geocode?q=a").status_code == 422
    assert client.get("/region/scenario?event_id=x&lat=0&lon=999").status_code == 422
