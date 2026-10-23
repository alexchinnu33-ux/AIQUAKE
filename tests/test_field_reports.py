import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import pytest
from fastapi.testclient import TestClient
from jose import jwt

import incident
from app import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_reports():
    incident.clear_reports()
    yield
    incident.clear_reports()


def auth():
    token = jwt.encode(
        {"sub": "1"}, os.getenv("SECRET_KEY"), algorithm=os.getenv("ALGORITHM", "HS256")
    )
    return {"Authorization": f"Bearer {token}"}


def sample(label, index=0):
    return client.get(f"/incident/sample-photo?label={label}&index={index}").content


def building_point():
    b = incident.rescue.load_case_scene().buildings[0]
    return {"lat": b["lat"], "lon": b["lon"]}


def test_sample_photo_endpoint_serves_images():
    assert sample("Collapsed")[:2] == b"\xff\xd8"  # JPEG magic bytes
    assert client.get("/incident/sample-photo?label=Nope").status_code == 422


def test_report_requires_login():
    response = client.post(
        "/incident/report",
        files={"photo": ("a.jpg", sample("Collapsed"), "image/jpeg")},
        data=building_point(),
    )
    assert response.status_code in (401, 403)


def test_report_far_from_any_building_is_rejected():
    response = client.post(
        "/incident/report",
        headers=auth(),
        files={"photo": ("a.jpg", sample("Collapsed"), "image/jpeg")},
        data={"lat": 10.0, "lon": -66.0},
    )
    assert response.status_code == 422


def test_non_image_is_rejected():
    response = client.post(
        "/incident/report",
        headers=auth(),
        files={"photo": ("a.txt", b"not an image", "text/plain")},
        data=building_point(),
    )
    assert response.status_code == 422


def test_report_updates_building_and_plan():
    point = building_point()
    before = client.get("/rescue/plan").json()["impact"]

    response = client.post(
        "/incident/report",
        headers=auth(),
        files={"photo": ("a.jpg", sample("Collapsed"), "image/jpeg")},
        data=point,
    )
    assert response.status_code == 200
    report = response.json()
    assert report["prediction"] in ("Collapsed", "Damaged", "Intact")

    after = client.get("/rescue/plan").json()["impact"]
    if report["applied"] and report["mapped_damage"] != report["previous_damage"]:
        assert after["damage_counts"] != before["damage_counts"]

    assert client.get("/incident/reports").json()[0]["id"] == report["id"]
    assert client.get("/incident/info").json()["field_reports"] == 1
