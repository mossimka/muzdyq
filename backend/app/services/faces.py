from __future__ import annotations

import logging
import threading
from pathlib import Path

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

try:  # OpenCV is optional at import time so the API can still boot without it.
    import cv2
except Exception:  # pragma: no cover - defensive
    cv2 = None  # type: ignore[assignment]

if cv2 is not None:
    # OpenCV 4 has setLogLevel; OpenCV 5 removed it. Never let an optional
    # logging tweak disable the face-blur pipeline.
    from contextlib import suppress

    with suppress(Exception):
        cv2.setLogLevel(3)  # type: ignore[attr-defined]
    with suppress(Exception):
        cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)  # type: ignore[attr-defined]

MODEL_PATH = Path(__file__).resolve().parent.parent / "assets" / "face_detection_yunet_2023mar.onnx"

_detector = None
_detector_lock = threading.Lock()


def _yunet_available() -> bool:
    return bool(cv2 is not None and hasattr(cv2, "FaceDetectorYN") and MODEL_PATH.exists())


def _cascade_available() -> bool:
    return bool(cv2 is not None and hasattr(cv2, "CascadeClassifier"))


def model_status() -> dict[str, object]:
    return {
        "yunet": _yunet_available(),
        "haar_cascade": _cascade_available(),
        "model_path": str(MODEL_PATH) if MODEL_PATH.exists() else None,
    }


def _get_yunet(width: int, height: int):  # type: ignore[no-untyped-def]
    global _detector
    if _detector is None:
        _detector = cv2.FaceDetectorYN.create(  # type: ignore[union-attr]
            str(MODEL_PATH), "", (width, height), 0.5, 0.3, 5000
        )
    _detector.setInputSize((width, height))
    return _detector


def detect_faces(image: Image.Image) -> list[tuple[int, int, int, int]]:
    """Return face boxes as ``(x, y, w, h)`` in image pixel coordinates."""
    if cv2 is None:
        return []

    rgb = np.asarray(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    height, width = bgr.shape[:2]
    if width < 24 or height < 24:
        return []

    boxes: list[tuple[int, int, int, int]] = []
    try:
        with _detector_lock:
            if _yunet_available():
                detector = _get_yunet(width, height)
                _, faces = detector.detect(bgr)
                if faces is not None:
                    for face in faces:
                        confidence = float(face[14]) if len(face) > 14 else 1.0
                        if confidence < 0.5:
                            continue
                        x, y, w, h = (int(v) for v in face[:4])
                        boxes.append((x, y, w, h))
            elif _cascade_available():
                gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
                cascade = cv2.CascadeClassifier(
                    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                )
                found = cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
                boxes.extend(tuple(int(v) for v in box) for box in found)
    except Exception as exc:  # pragma: no cover - keep uploads resilient
        logger.warning("Face detection failed, continuing without blur: %s", exc)
        return []

    clipped = []
    for x, y, w, h in boxes:
        x = max(0, min(x, width - 1))
        y = max(0, min(y, height - 1))
        w = max(1, min(w, width - x))
        h = max(1, min(h, height - y))
        clipped.append((x, y, w, h))
    return clipped


def blur_regions(image: Image.Image, boxes: list[tuple[int, int, int, int]]) -> int:
    """Pixelate + Gaussian-blur each region. Returns the number of regions changed."""
    if not boxes:
        return 0
    width, height = image.size
    changed = 0
    for x, y, w, h in boxes:
        padding = int(max(w, h) * 0.28)
        left = max(0, x - padding)
        top = max(0, y - padding)
        right = min(width, x + w + padding)
        bottom = min(height, y + h + padding)
        if right - left < 2 or bottom - top < 2:
            continue
        region = image.crop((left, top, right, bottom))
        small = region.resize(
            (max(1, region.width // 14), max(1, region.height // 14)),
            Image.Resampling.BILINEAR,
        )
        pixelated = small.resize(region.size, Image.Resampling.NEAREST)
        from PIL import ImageFilter

        blurred = pixelated.filter(ImageFilter.GaussianBlur(radius=max(5, min(region.size) // 10)))
        image.paste(blurred, (left, top))
        changed += 1
    return changed


def blur_faces(image: Image.Image) -> tuple[Image.Image, int]:
    boxes = detect_faces(image)
    return image, blur_regions(image, boxes)
