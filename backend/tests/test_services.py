from __future__ import annotations

import io
from pathlib import Path

import pytest
from PIL import Image

from app.services.faces import blur_regions, detect_faces
from app.services.phash import compute_phash, hamming_distance
from app.services.ratelimit import RateLimiter
from app.services.storage import LocalStorage

from .helpers import make_image, read_face_image


def test_phash_identity_and_distance() -> None:
    first = Image.open(io.BytesIO(make_image(label="phash-a")))
    second = Image.open(io.BytesIO(make_image(label="phash-b", colour=(200, 40, 90))))
    hash_first = compute_phash(first)
    assert hash_first == compute_phash(first)
    assert len(hash_first) == 16
    assert hamming_distance(hash_first, hash_first) == 0
    assert hamming_distance(hash_first, compute_phash(second)) > 0
    assert hamming_distance(None, hash_first) == 999


def test_face_blur_changes_pixels() -> None:
    face = Image.open(io.BytesIO(read_face_image())).convert("RGB")
    boxes = detect_faces(face)
    assert boxes
    before = face.crop(
        (
            max(0, boxes[0][0] - 10),
            max(0, boxes[0][1] - 10),
            boxes[0][0] + boxes[0][2] + 10,
            boxes[0][1] + boxes[0][3] + 10,
        )
    )
    changed = blur_regions(face, boxes)
    assert changed == len(boxes)
    after = face.crop(
        (
            max(0, boxes[0][0] - 10),
            max(0, boxes[0][1] - 10),
            boxes[0][0] + boxes[0][2] + 10,
            boxes[0][1] + boxes[0][3] + 10,
        )
    )
    assert before.tobytes() != after.tobytes()


def test_storage_blocks_path_traversal(tmp_path: Path) -> None:
    storage = LocalStorage(tmp_path / "media")
    assert storage.save("photos/ok.jpg", b"data") == "photos/ok.jpg"
    assert storage.read("photos/ok.jpg") == b"data"
    assert storage.exists("photos/ok.jpg")
    storage.delete("photos/ok.jpg")
    assert not storage.exists("photos/ok.jpg")

    with pytest.raises(ValueError):
        storage.save("../escape.jpg", b"nope")
    with pytest.raises(ValueError):
        storage.save("/absolute.jpg", b"nope")


def test_rate_limiter_sliding_window() -> None:
    limiter = RateLimiter()
    allowed, _ = limiter.consume("k", 2, 60)
    assert allowed
    allowed, _ = limiter.consume("k", 2, 60)
    assert allowed
    allowed, retry_after = limiter.consume("k", 2, 60)
    assert not allowed
    assert retry_after >= 1
    limiter.reset()
    assert limiter.consume("k", 2, 60)[0]
