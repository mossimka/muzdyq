from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app

from .conftest import build_settings


def test_demo_seed_is_visible_idempotent_and_clearly_labelled(tmp_path: Path) -> None:
    settings = build_settings(
        tmp_path,
        seed_demo=True,
        seed_references=True,
        demo_photos_per_point=1,
    )
    with TestClient(create_app(settings)) as client:
        points = client.get("/api/points").json()
        assert len(points) == 7
        assert all(point["photo_count"] == 1 for point in points)
        assert all(point["demo"] is True for point in points)

        photos = client.get("/api/points/tuyuksu-glacier/photos").json()["items"]
        assert len(photos) == 1
        photo = photos[0]
        assert photo["is_demo"] is True
        assert photo["taken_at"].startswith("2021-08-12")
        assert photo["tags"]["demo"] is True
        assert client.get(photo["thumb_url"]).status_code == 200
        assert client.get(photo["url"]).status_code == 200

        reference = client.get("/api/points/tuyuksu-glacier").json()["viewpoints"][0][
            "reference_photo_url"
        ]
        assert reference
        assert client.get(reference).status_code == 200

        export = client.get("/api/export/photos.geojson").json()
        assert len(export["features"]) == 7
        assert all(feature["properties"]["is_demo"] for feature in export["features"])

    # Restarting the same deployment must not duplicate seed photos.
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/points/tuyuksu-glacier").json()["photo_count"] == 1
        assert len(client.get("/api/export/photos.json").json()["photos"]) == 7
