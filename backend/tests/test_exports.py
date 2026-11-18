from __future__ import annotations

import csv
import io
import json
import zipfile

from fastapi.testclient import TestClient

from .helpers import make_image, upload, upload_two_distinct


def test_csv_export_without_auth(client: TestClient) -> None:
    upload_two_distinct(client)
    response = client.get("/api/export/photos.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["x-data-license"] == "CC-BY-4.0"
    assert "attachment" in response.headers["content-disposition"]

    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert len(rows) == 2
    assert set(rows[0]) == {
        "photo_id",
        "point_slug",
        "point_name_en",
        "point_type",
        "viewpoint_id",
        "taken_at",
        "uploaded_at",
        "lat",
        "lon",
        "elevation_m",
        "width",
        "height",
        "bytes",
        "license",
        "weather",
        "visibility",
        "snow_cover",
        "is_demo",
        "photo_url",
        "thumb_url",
    }
    assert rows[0]["point_slug"] == "tuyuksu-glacier"
    assert rows[0]["lat"] == "43.0417"
    assert rows[0]["lon"] == "77.0792"
    assert rows[0]["license"] == "CC-BY-4.0"
    assert rows[0]["photo_url"].startswith("http://testserver/api/photos/")


def test_geojson_export_uses_only_monitoring_point_coordinates(client: TestClient) -> None:
    upload_two_distinct(client)
    response = client.get("/api/export/photos.geojson")
    assert response.status_code == 200
    payload = json.loads(response.content)
    assert payload["type"] == "FeatureCollection"
    assert payload["license"] == "CC-BY-4.0"
    assert "not measurements" in payload["disclaimer"]
    assert len(payload["features"]) == 2

    feature = payload["features"][0]
    assert feature["geometry"]["type"] == "Point"
    assert feature["geometry"]["coordinates"] == [77.0792, 43.0417]
    assert feature["properties"]["coordinate_source"] == "hardcoded_monitoring_point"
    assert feature["properties"]["coords_verified"] is False
    assert feature["properties"]["is_demo"] is False


def test_json_export(client: TestClient) -> None:
    upload_two_distinct(client)
    response = client.get("/api/export/photos.json")
    assert response.status_code == 200
    payload = json.loads(response.content)
    assert payload["count"] == 2
    assert payload["license_url"].startswith("https://creativecommons.org/licenses/by/4.0")
    assert len(payload["photos"]) == 2
    photo = payload["photos"][0]
    assert "lat" in photo and "lon" in photo
    assert "gps" not in {key.lower() for key in photo}


def test_zip_export_contains_images_metadata_and_license(client: TestClient) -> None:
    photos = upload_two_distinct(client)
    response = client.get("/api/export/photos.zip")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["x-data-license"] == "CC-BY-4.0"

    archive = zipfile.ZipFile(io.BytesIO(response.content))
    names = archive.namelist()
    assert "metadata.csv" in names
    assert "metadata.json" in names
    assert "photos.geojson" in names
    assert "LICENSE.txt" in names
    image_names = [name for name in names if name.startswith("images/")]
    assert len(image_names) == 2
    for photo in photos:
        assert any(photo["id"] in name for name in image_names)
        assert archive.read(next(name for name in image_names if photo["id"] in name)).startswith(
            b"\xff\xd8"
        )
    license_text = archive.read("LICENSE.txt").decode()
    assert "CC BY 4.0" in license_text or "CC-BY-4.0" in license_text
    assert "not measurements" in license_text


def test_export_can_be_filtered_by_point(client: TestClient) -> None:
    upload_two_distinct(client)
    response = client.get("/api/export/photos.csv?point=big-almaty-lake")
    assert response.status_code == 200
    assert len(list(csv.DictReader(io.StringIO(response.text)))) == 0

    response = client.get("/api/export/photos.zip?point=tuyuksu-glacier")
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert len([name for name in archive.namelist() if name.startswith("images/")]) == 2

    missing = client.get("/api/export/photos.csv?point=nope")
    assert missing.status_code == 404


def test_export_respects_date_range(client: TestClient) -> None:
    upload_two_distinct(client)  # July + August 2025
    response = client.get("/api/export/photos.json?from=2025-08-01&to=2025-08-31")
    payload = json.loads(response.content)
    assert payload["count"] == 1
    assert payload["photos"][0]["taken_at"].startswith("2025-08")


def test_pagination_cursor(client: TestClient) -> None:
    for day in (1, 2, 3):
        response = upload(
            client,
            make_image(label=f"page-{day}", colour=(day * 40, 80, 120)),
            taken_at=f"2025-06-{day:02d}T10:00:00Z",
        )
        assert response.status_code == 201, response.text

    first = client.get("/api/points/tuyuksu-glacier/photos?limit=2")
    payload = first.json()
    assert len(payload["items"]) == 2
    assert payload["next_cursor"]
    assert payload["items"][0]["taken_at"].startswith("2025-06-03")

    second = client.get(
        f"/api/points/tuyuksu-glacier/photos?limit=2&cursor={payload['next_cursor']}"
    )
    payload2 = second.json()
    assert len(payload2["items"]) == 1
    assert payload2["next_cursor"] is None
    assert payload2["items"][0]["taken_at"].startswith("2025-06-01")

    bad = client.get("/api/points/tuyuksu-glacier/photos?cursor=not-base64")
    assert bad.status_code == 422
