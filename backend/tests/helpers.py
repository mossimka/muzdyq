from __future__ import annotations

import hashlib
import io
import random
import uuid
from datetime import UTC, datetime
from typing import Any

import piexif
from PIL import Image, ImageDraw
from starlette.testclient import TestClient


def make_image(
    width: int = 900,
    height: int = 600,
    *,
    colour: tuple[int, int, int] = (70, 120, 160),
    with_exif: bool = True,
    label: str = "test",
) -> bytes:
    image = Image.new("RGB", (width, height), colour)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, int(height * 0.55), width, height), fill=(30, 60, 50))
    draw.polygon(
        [(0, height), (width * 0.4, height * 0.2), (width * 0.7, height)],
        fill=(220, 230, 235),
    )
    draw.polygon(
        [(width * 0.45, height), (width * 0.78, height * 0.3), (width, height)],
        fill=(120, 140, 150),
    )
    # Distinct labels get distinct geometry so perceptual hashes differ.
    seed = int(hashlib.sha256(f"{label}:{colour}".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    for _ in range(7):
        cx = rng.randint(20, width - 20)
        cy = rng.randint(20, height - 20)
        radius = rng.randint(12, max(14, width // 7))
        shade = rng.randint(40, 230)
        draw.ellipse(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            fill=(shade, (shade * 3) % 256, (shade * 7) % 256),
        )
    draw.text((30, 30), label, fill=(255, 255, 255))

    buffer = io.BytesIO()
    if with_exif:
        exif_bytes = piexif.dump(
            {
                "0th": {
                    piexif.ImageIFD.Make: b"MuzdyqTestPhone",
                    piexif.ImageIFD.Model: b"OldLowEnd",
                    piexif.ImageIFD.Software: b"test-suite",
                },
                "Exif": {
                    piexif.ExifIFD.DateTimeOriginal: b"1999:01:01 00:00:00",
                },
                "GPS": {
                    piexif.GPSIFD.GPSDateStamp: b"1999:01:01",
                    piexif.GPSIFD.GPSLatitudeRef: b"N",
                    piexif.GPSIFD.GPSLatitude: ((43, 1), (2, 1), (30, 1)),
                    piexif.GPSIFD.GPSLongitudeRef: b"E",
                    piexif.GPSIFD.GPSLongitude: ((77, 1), (4, 1), (45, 1)),
                    piexif.GPSIFD.GPSAltitude: (2500, 1),
                },
            }
        )
        image.save(buffer, format="JPEG", quality=88, exif=exif_bytes)
    else:
        image.save(buffer, format="JPEG", quality=88)
    return buffer.getvalue()


def read_face_image() -> bytes:
    from pathlib import Path

    return (Path(__file__).parent / "assets" / "face.jpg").read_bytes()


def point_payload(client: TestClient, slug: str = "tuyuksu-glacier") -> dict[str, Any]:
    response = client.get(f"/api/points/{slug}")
    assert response.status_code == 200, response.text
    return response.json()


def upload(
    client: TestClient,
    image: bytes,
    *,
    slug: str = "tuyuksu-glacier",
    viewpoint_id: str | None = None,
    client_uuid: str | None = None,
    taken_at: str = "2025-07-14T13:47:00Z",
    tags: dict | None = None,
    content_type: str = "image/jpeg",
    filename: str = "photo.jpg",
    device_token: str | None = None,
):
    point = point_payload(client, slug)
    viewpoint = viewpoint_id or point["viewpoints"][0]["id"]
    headers = {"X-Device-Token": device_token} if device_token else {}
    return client.post(
        f"/api/points/{slug}/photos",
        files={"file": (filename, image, content_type)},
        data={
            "viewpoint_id": viewpoint,
            "taken_at": taken_at,
            "client_uuid": client_uuid or str(uuid.uuid4()),
            "tags": __import__("json").dumps(tags or {"weather": "clear", "snow_cover": "partial"}),
        },
        headers=headers,
    )


def upload_two_distinct(client: TestClient, slug: str = "tuyuksu-glacier") -> list[dict]:
    first = upload(client, make_image(colour=(60, 100, 150), label="one"), slug=slug)
    second = upload(
        client,
        make_image(colour=(140, 90, 70), label="two"),
        slug=slug,
        taken_at="2025-08-20T09:15:00Z",
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    return [first.json()["photo"], second.json()["photo"]]


def now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
