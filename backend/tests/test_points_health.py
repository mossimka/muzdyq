from __future__ import annotations

from fastapi.testclient import TestClient

from .helpers import upload


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"
    assert payload["storage"] == "ok"
    assert payload["counts"]["points"] == 7
    assert payload["counts"]["photos"] == 0


def test_points_are_seeded_and_hardcoded(client: TestClient) -> None:
    response = client.get("/api/points")
    assert response.status_code == 200
    points = response.json()
    assert len(points) == 7
    slugs = {point["slug"] for point in points}
    assert {
        "tuyuksu-glacier",
        "big-almaty-lake",
        "ayusay-viewpoint",
        "shymbulak-viewpoint",
        "talgar-glacier",
        "kimasar-lakes",
        "issyk-lake",
    } <= slugs
    types = {point["type"] for point in points}
    assert types == {"glacier", "water"}

    for point in points:
        assert point["coords_verified"] is False
        assert point["lat"] and point["lon"]
        assert point["name_i18n"].keys() >= {"en", "ru", "kk"}
        assert point["safety_note_i18n"]["en"]
        assert len(point["viewpoints"]) >= 1
        assert point["photo_count"] == 0

    tuyuksu = next(point for point in points if point["slug"] == "tuyuksu-glacier")
    assert len(tuyuksu["viewpoints"]) == 2
    assert abs(tuyuksu["lat"] - 43.04) < 0.1
    assert abs(tuyuksu["lon"] - 77.08) < 0.1
    assert tuyuksu["elevation_m"] == 3450


def test_point_detail_and_404(client: TestClient) -> None:
    response = client.get("/api/points/big-almaty-lake")
    assert response.status_code == 200
    assert response.json()["type"] == "water"
    assert response.json()["viewpoints"][0]["id"] == "big-almaty-lake-v1"

    missing = client.get("/api/points/does-not-exist")
    assert missing.status_code == 404


def test_photo_list_empty_with_cursor_shape(client: TestClient) -> None:
    response = client.get("/api/points/tuyuksu-glacier/photos")
    assert response.status_code == 200
    assert response.json() == {"items": [], "next_cursor": None}


def test_photos_can_be_filtered_by_year(client: TestClient) -> None:
    from .helpers import make_image

    assert upload(client, make_image(label="2024"), taken_at="2024-08-01T10:00:00Z").status_code == 201
    assert upload(client, make_image(label="2025", colour=(10, 90, 70)), taken_at="2025-08-01T10:00:00Z").status_code == 201

    response = client.get("/api/points/tuyuksu-glacier/photos?year=2024")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["taken_at"].startswith("2024-08-01")

    bad = client.get("/api/points/tuyuksu-glacier/photos?from=not-a-date")
    assert bad.status_code == 422
