from __future__ import annotations

import io
import uuid

import piexif
from fastapi.testclient import TestClient
from PIL import Image

from app.services import faces
from app.services.images import ImageValidationError, process_upload

from .helpers import make_image, read_face_image, upload


def test_upload_strips_exif_gps_and_uses_client_time(client: TestClient) -> None:
    original = make_image(label="exif")
    original_image = Image.open(io.BytesIO(original))
    assert dict(original_image.getexif())  # sanity: fixture really has EXIF
    assert piexif.load(original).get("GPS")  # and real GPS coordinates

    response = upload(
        client,
        original,
        taken_at="2025-07-14T13:47:52Z",
        tags={"weather": "clear", "visibility": "good", "snow_cover": "partial"},
    )
    assert response.status_code == 201, response.text
    photo = response.json()["photo"]

    # Time comes from the client and is reduced to hourly precision; the EXIF
    # timestamp (1999) is ignored entirely.
    assert photo["taken_at"] == "2025-07-14T13:00:00Z"
    assert photo["license"] == "CC-BY-4.0"
    assert photo["is_demo"] is False
    assert photo["tags"]["weather"] == "clear"
    assert photo["tags"]["automation"]["exif_stripped"] is True
    assert photo["tags"]["automation"]["checks"] == "passed"

    stored = client.get(photo["url"])
    assert stored.status_code == 200
    assert stored.headers["x-data-license"] == "CC-BY-4.0"
    output_image = Image.open(io.BytesIO(stored.content))
    assert len(dict(output_image.getexif())) == 0
    assert "exif" not in output_image.info
    assert b"MuzdyqTestPhone" not in stored.content
    assert b"GPS" not in stored.content
    try:
        parsed = piexif.load(stored.content)
        assert not parsed.get("GPS")
        assert not parsed.get("0th")
    except Exception:
        # No valid EXIF segment at all is the desired outcome.
        pass


def test_faces_are_blurred_on_the_server(client: TestClient) -> None:
    raw = read_face_image()
    assert faces.detect_faces(Image.open(io.BytesIO(raw)))  # face present in fixture

    response = upload(client, raw)
    assert response.status_code == 201, response.text
    photo = response.json()["photo"]
    assert photo["tags"]["automation"]["faces_blurred"] >= 1

    stored = client.get(photo["url"])
    assert stored.status_code == 200
    processed = Image.open(io.BytesIO(stored.content))
    assert faces.detect_faces(processed) == []


def test_upload_is_idempotent_by_client_uuid(client: TestClient) -> None:
    client_uuid = str(uuid.uuid4())
    first = upload(client, make_image(label="first"), client_uuid=client_uuid)
    assert first.status_code == 201
    photo_id = first.json()["photo"]["id"]

    # A retry after a flaky connection may even carry a different file; the
    # server must return the original record exactly once.
    second = upload(
        client,
        make_image(colour=(10, 120, 90), label="retry"),
        client_uuid=client_uuid,
    )
    assert second.status_code == 200
    assert second.headers.get("x-idempotent-replay") == "true"
    assert second.json()["photo"]["id"] == photo_id
    assert second.json()["duplicate"] is True

    listing = client.get("/api/points/tuyuksu-glacier/photos")
    assert len(listing.json()["items"]) == 1


def test_near_duplicate_image_is_rejected(client: TestClient) -> None:
    raw = make_image(label="duplicate")
    first = upload(client, raw)
    assert first.status_code == 201

    second = upload(client, raw)
    assert second.status_code == 409
    detail = second.json()["detail"]
    assert detail["code"] == "duplicate_photo"
    assert detail["existing_photo_id"] == first.json()["photo"]["id"]

    listing = client.get("/api/points/tuyuksu-glacier/photos")
    assert len(listing.json()["items"]) == 1


def test_rejects_bad_types_viewpoints_and_timestamps(client: TestClient) -> None:
    bad_type = upload(client, b"hello, not an image", content_type="text/plain")
    assert bad_type.status_code == 415

    bad_image = upload(client, b"still not an image", content_type="image/jpeg")
    assert bad_image.status_code == 422

    bad_viewpoint = upload(client, make_image(), viewpoint_id="talgar-glacier-v1")
    assert bad_viewpoint.status_code == 422
    assert bad_viewpoint.json()["detail"]["code"] == "invalid_viewpoint"

    matching_uuid = str(uuid.uuid4())
    known = client.get("/api/points/tuyuksu-glacier").json()
    wrong_uuid = client.post(
        "/api/points/big-almaty-lake/photos",
        files={"file": ("x.jpg", make_image(), "image/jpeg")},
        data={
            "viewpoint_id": "big-almaty-lake-v1",
            "taken_at": "2025-01-01T10:00:00Z",
            "client_uuid": matching_uuid,
            "tags": "{}",
        },
    )
    assert wrong_uuid.status_code == 201
    conflict = client.post(
        "/api/points/tuyuksu-glacier/photos",
        files={"file": ("x.jpg", make_image(colour=(1, 2, 3)), "image/jpeg")},
        data={
            "viewpoint_id": known["viewpoints"][0]["id"],
            "taken_at": "2025-01-01T10:00:00Z",
            "client_uuid": matching_uuid,
            "tags": "{}",
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "client_uuid_conflict"

    future = upload(client, make_image(colour=(5, 5, 5)), taken_at="2099-01-01T10:00:00Z")
    assert future.status_code == 422

    bad_uuid = upload(client, make_image(colour=(6, 6, 6)), client_uuid="not-a-uuid")
    assert bad_uuid.status_code == 422


def test_tags_are_whitelisted(client: TestClient) -> None:
    response = upload(
        client,
        make_image(colour=(20, 40, 60)),
        tags={
            "weather": "clear",
            "visibility": "<script>",
            "snow_cover": "full",
            "note": "my name is Alice, phone +7...",
            "demo": True,
        },
    )
    assert response.status_code == 201
    tags = response.json()["photo"]["tags"]
    assert tags["weather"] == "clear"
    assert tags["snow_cover"] == "full"
    assert "visibility" not in tags
    assert "note" not in tags
    assert "demo" not in tags


def test_rate_limit_returns_429(client, settings, tmp_path) -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    limited = settings.model_copy(
        update={
            "database_url": f"sqlite:///{tmp_path / 'limited.db'}",
            "upload_limit_per_minute": 1,
            "upload_limit_per_hour": 100,
        }
    )
    with TestClient(create_app(limited)) as limited_client:
        first = upload(limited_client, make_image(label="limited-1"), device_token="device-a")
        assert first.status_code == 201
        second = upload(
            limited_client,
            make_image(label="limited-2", colour=(90, 30, 20)),
            device_token="device-a",
        )
        assert second.status_code == 429
        assert int(second.headers["retry-after"]) >= 1


def test_oversized_upload_is_rejected(settings, tmp_path) -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    small = settings.model_copy(
        update={
            "database_url": f"sqlite:///{tmp_path / 'small.db'}",
            "max_upload_bytes": 2048,
        }
    )
    with TestClient(create_app(small)) as small_client:
        response = upload(small_client, make_image(), filename="big.jpg")
    assert response.status_code == 413


def test_pipeline_rejects_text_and_keeps_dimensions() -> None:
    import pytest

    with pytest.raises(ImageValidationError):
        process_upload(b"<html>not an image</html>", "image/jpeg")

    processed = process_upload(make_image(2400, 1200), "image/jpeg")
    assert max(processed.width, processed.height) <= 2048
    assert processed.data.startswith(b"\xff\xd8")  # JPEG
    assert len(processed.phash) == 16
