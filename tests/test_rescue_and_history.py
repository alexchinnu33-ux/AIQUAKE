import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import pytest
from fastapi.testclient import TestClient

import rescue
from app import app

client = TestClient(app)


def test_impact_is_consistent_with_damage_counts():
    impact = rescue.load_case_scene().impact_summary("night")
    assert impact["total_buildings"] == sum(impact["damage_counts"].values())
    assert impact["estimated_trapped"] <= impact["estimated_population"]
    assert impact["estimated_displaced"] <= impact["estimated_population"]


def test_day_has_fewer_people_at_home_than_night():
    assert (
        rescue.load_case_scene().impact_summary("day")["estimated_population"]
        < rescue.load_case_scene().impact_summary("night")["estimated_population"]
    )


def test_zones_are_ranked_by_priority():
    zones = rescue.load_case_scene().build_zones()
    scores = [z["priority_score"] for z in zones]
    assert scores == sorted(scores, reverse=True)
    assert zones[0]["tier"] == "CRITICAL"


def test_every_routed_zone_is_assigned_to_exactly_one_team():
    plan = rescue.build_plan(None, teams=3, top_zones=10)
    stops = [s["zone_id"] for r in plan["routes"] for s in r["stops"]]
    assert len(stops) == len(set(stops)) == plan["routed_zone_count"]


def test_more_teams_do_not_finish_later():
    one = rescue.build_plan(None, teams=1, top_zones=10)["routes"]
    four = rescue.build_plan(None, teams=4, top_zones=10)["routes"]
    assert max(r["finish_min"] for r in four) <= max(r["finish_min"] for r in one)


def test_plan_endpoint():
    response = client.get("/rescue/plan?teams=2&top_zones=5")
    assert response.status_code == 200
    body = response.json()
    assert body["routes"] and body["zones"] and body["facilities"]


def test_plan_endpoint_validates_input():
    assert client.get("/rescue/plan?teams=99").status_code == 422


def test_history_archive_filters():
    body = client.get(
        "/earthquakes/history?source=archive&start_year=2004&end_year=2011&min_magnitude=9"
    ).json()
    assert {e["year"] for e in body["events"]} == {2004, 2011}
    assert body["events"] == sorted(
        body["events"], key=lambda e: e["magnitude"], reverse=True
    )


def test_analyze_endpoint_with_sample_imagery():
    root = Path(__file__).resolve().parent.parent / "ai" / "model2" / "samples"
    meta = {"west": -66.83, "south": 10.600, "east": -66.82, "north": 10.610}
    with open(root / "pre" / "sample_001.png", "rb") as pre, open(
        root / "post" / "sample_001.png", "rb"
    ) as post:
        response = client.post(
            "/rescue/analyze",
            files={"pre_image": pre, "post_image": post},
            data={**meta, "teams": 2},
        )
    assert response.status_code in (200, 503)  # 503 only if Overpass is offline
    if response.status_code == 200:
        body = response.json()
        assert body["unit"] == "damage regions"
        assert "damage_geojson" in body and "zones" in body


def test_analyze_rejects_bad_bounds():
    root = Path(__file__).resolve().parent.parent / "ai" / "model2" / "samples"
    with open(root / "pre" / "sample_001.png", "rb") as pre:
        response = client.post(
            "/rescue/analyze",
            files={"pre_image": pre, "post_image": pre},
            data={"west": 5, "south": 0, "east": 4, "north": 1},
        )
    assert response.status_code == 422
