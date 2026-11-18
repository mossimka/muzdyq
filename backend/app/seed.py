from __future__ import annotations

import hashlib
import json
import logging
import math
import random
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .models import Photo, Point, Viewpoint
from .services.phash import compute_phash
from .services.storage import Storage
from .utils import utcnow

logger = logging.getLogger(__name__)

DEMO_NAMESPACE = uuid.UUID("f3c4d9e6-6d2b-4f1a-9d38-6e6a4b3c2f10")
DEMO_START_YEAR = 2021
WEATHER = ["clear", "partly_cloudy", "overcast", "fog"]
VISIBILITY = ["good", "medium", "poor"]
SNOW_COVER = ["none", "partial", "full"]


@dataclass
class SeedResult:
    points_created: int = 0
    points_updated: int = 0
    viewpoints: int = 0
    references: int = 0
    demo_photos: int = 0


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:  # pragma: no cover
                continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # pragma: no cover - old Pillow
        return ImageFont.load_default()


def _ridge_layer(
    width: int,
    height: int,
    base_ratio: float,
    amplitude: int,
    seed: int,
    colour: tuple[int, int, int],
) -> list[tuple[int, int]]:
    rng = random.Random(seed)
    base = int(height * base_ratio)
    points = [(0, height)]
    phase = rng.random() * math.pi * 2
    for x in range(0, width + 24, 24):
        y = (
            base
            + int(math.sin(x / width * math.pi * 2.2 + phase) * amplitude * 0.32)
            + rng.randint(-amplitude // 3, amplitude // 3)
        )
        points.append((x, max(0, y)))
    points.append((width, height))
    return points


def render_demo_scene(
    point: Point,
    year: int,
    label: str = "DEMO PHOTO — NOT A REAL OBSERVATION",
) -> Image.Image:
    """Generate a clearly-labelled synthetic mountain scene reproducibly.

    The scene is intentionally stylised: it must never be mistaken for a real
    observation. Snowline shifts slightly by year to demonstrate a time series.
    """
    width, height = 1080, 720
    rng = random.Random(f"{point.slug}:{year}:{point.id}")
    top = (18, 54, 88)
    horizon = (156, 195, 214)
    image = Image.new("RGB", (width, height), top)
    pixels = np.asarray(image).copy()
    for y in range(height):
        ratio = y / height
        pixels[y, :, :] = [
            int(top[0] * (1 - ratio) + horizon[0] * ratio),
            int(top[1] * (1 - ratio) + horizon[1] * ratio),
            int(top[2] * (1 - ratio) + horizon[2] * ratio),
        ]
    image = Image.fromarray(pixels)

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    sun_x = rng.randint(int(width * 0.55), int(width * 0.85))
    draw.ellipse((sun_x - 60, 55, sun_x + 60, 175), fill=(255, 242, 196, 90))
    draw.ellipse((sun_x - 30, 85, sun_x + 30, 145), fill=(255, 249, 224, 180))

    for _ in range(7):
        cx = rng.randint(-100, width + 100)
        cy = rng.randint(60, int(height * 0.38))
        rx = rng.randint(70, 210)
        ry = rng.randint(14, 38)
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(240, 247, 252, 42))

    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(image)

    ridge_colours = [(73, 104, 126), (58, 87, 108), (43, 69, 88), (29, 49, 63)]
    for index, colour in enumerate(ridge_colours):
        layer = _ridge_layer(
            width,
            height,
            0.34 + index * 0.13,
            130 + index * 40,
            seed=int(
                hashlib.sha256(f"{point.slug}:{year}:{index}".encode()).hexdigest()[:6], 16
            ),
            colour=colour,
        )
        draw.polygon(layer, fill=colour)

    # Snowline retreats subtly with each demo year (still synthetic).
    retreat = (year - DEMO_START_YEAR) * 10
    snow_points = [(0, height), (0, int(height * 0.52))]
    for x in range(0, width + 20, 20):
        y = (
            int(height * 0.34)
            + int(math.sin(x / 90.0) * 34)
            + int(math.sin(x / 37.0) * 15)
            + retreat
        )
        snow_points.append((x, y))
    snow_points.extend([(width, height), (width, int(height * 0.52))])
    draw.polygon(snow_points, fill=(230, 240, 246))
    draw.line(snow_points[2:-2], fill=(196, 219, 232), width=4)

    if point.type == "glacier":
        tongue_top = int(height * 0.42) + retreat
        tongue_bottom = int(height * 0.66)
        tongue = [
            (int(width * 0.47), tongue_top),
            (int(width * 0.55), tongue_top + 20),
            (int(width * 0.60), tongue_bottom),
            (int(width * 0.54), tongue_bottom + 45),
            (int(width * 0.43), tongue_bottom),
            (int(width * 0.40), tongue_top + 60),
        ]
        draw.polygon(tongue, fill=(213, 232, 242))
        draw.line(tongue + [tongue[0]], fill=(160, 193, 211), width=3)
        for crevasse in range(6):
            y = tongue_top + 30 + crevasse * 18
            draw.line(
                (int(width * 0.44), y, int(width * 0.58), y + 6),
                fill=(151, 184, 203),
                width=2,
            )
        # Moraine ridges in front of the tongue.
        draw.polygon(
            [
                (int(width * 0.29), int(height * 0.79)),
                (int(width * 0.47), int(height * 0.66)),
                (int(width * 0.49), int(height * 0.72)),
                (int(width * 0.34), int(height * 0.84)),
            ],
            fill=(104, 98, 88),
        )
        draw.polygon(
            [
                (int(width * 0.56), int(height * 0.68)),
                (int(width * 0.76), int(height * 0.80)),
                (int(width * 0.70), int(height * 0.86)),
                (int(width * 0.54), int(height * 0.75)),
            ],
            fill=(96, 90, 81),
        )
    else:
        lake_top = int(height * (0.62 + (year - DEMO_START_YEAR) * 0.003))
        draw.ellipse(
            (int(width * 0.14), lake_top, int(width * 0.86), int(height * 0.94)),
            fill=(42, 106, 132),
        )
        draw.ellipse(
            (int(width * 0.18), lake_top + 10, int(width * 0.82), int(height * 0.90)),
            fill=(62, 137, 163),
        )
        for line in range(8):
            y = lake_top + 26 + line * 15
            draw.line(
                (
                    int(width * 0.22 + rng.randint(0, 60)),
                    y,
                    int(width * 0.74 - rng.randint(0, 60)),
                    y,
                ),
                fill=(150, 202, 218),
                width=2,
            )
        draw.polygon(
            [
                (int(width * 0.10), int(height * 0.76)),
                (int(width * 0.28), int(height * 0.62)),
                (int(width * 0.34), int(height * 0.78)),
            ],
            fill=(92, 84, 70),
        )

    # Foreground rocks and meadow.
    draw.polygon(
        [(0, height), (0, int(height * 0.88)), (int(width * 0.22), int(height * 0.80)),
         (int(width * 0.38), height)],
        fill=(37, 50, 41),
    )
    draw.polygon(
        [(width, height), (width, int(height * 0.86)), (int(width * 0.78), int(height * 0.80)),
         (int(width * 0.64), height)],
        fill=(32, 45, 37),
    )

    array = np.asarray(image).astype(np.int16)
    noise = np.random.default_rng(rng.randint(0, 2**31)).normal(0, 3.2, array.shape)
    array = np.clip(array + noise, 0, 255).astype(np.uint8)
    image = Image.fromarray(array)

    draw = ImageDraw.Draw(image, "RGBA")
    band_height = max(80, int(height * 0.115))
    draw.rectangle((0, height - band_height, width, height), fill=(9, 26, 36, 218))
    draw.rectangle((0, 0, width - 1, height - 1), outline=(255, 255, 255, 90), width=3)
    title_font = _font(max(16, int(height * 0.033)), bold=True)
    meta_font = _font(max(13, int(height * 0.023)))
    draw.text((26, height - band_height + 14), label, font=title_font, fill=(255, 214, 102, 255))
    meta = f"{point.name_i18n.get('en', point.slug)} · {year} · synthetic seed placeholder"
    draw.text((26, height - band_height + 14 + int(height * 0.045)), meta, font=meta_font, fill=(234, 242, 246, 255))
    tag = "DEMO · NOT AN OBSERVATION"
    bbox = draw.textbbox((0, 0), tag, font=meta_font)
    pad = 10
    draw.rounded_rectangle(
        (width - (bbox[2] - bbox[0]) - 26 - pad * 2, 18, width - 26, 18 + (bbox[3] - bbox[1]) + pad * 2),
        radius=6,
        fill=(9, 26, 36, 225),
        outline=(255, 214, 102, 210),
        width=2,
    )
    draw.text((width - (bbox[2] - bbox[0]) - 26 - pad, 18 + pad - 2), tag, font=meta_font, fill=(255, 214, 102, 255))
    return image


def render_reference_scene(point: Point, viewpoint: Viewpoint) -> Image.Image:
    image = render_demo_scene(point, DEMO_START_YEAR, label="REFERENCE VIEW — DEMO FRAME")
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    heading = viewpoint.heading_deg if viewpoint.heading_deg is not None else 0
    note = viewpoint.note_i18n.get("en", "") if viewpoint.note_i18n else ""
    font = _font(20, bold=True)
    small = _font(16)
    text = f"{point.name_i18n.get('en', point.slug)} · {heading}° · {viewpoint.id}"
    draw.rectangle((20, height - 190, width - 20, height - 96), fill=(9, 26, 36, 220))
    draw.text((34, height - 180), text, font=font, fill=(255, 255, 255, 255))
    if note:
        draw.text((34, height - 148), note[:96], font=small, fill=(210, 226, 235, 255))
    # Alignment crosshair (ghost overlay guide).
    cx, cy = width // 2, int(height * 0.44)
    draw.line((cx - 40, cy, cx + 40, cy), fill=(255, 214, 102, 190), width=2)
    draw.line((cx, cy - 40, cx, cy + 40), fill=(255, 214, 102, 190), width=2)
    return image


def _encode_scene(image: Image.Image) -> tuple[bytes, bytes, int, int]:
    from .services.images import _encode_jpeg, _resize_long_edge

    stored_image = _resize_long_edge(image.convert("RGB"), 1600)
    data = _encode_jpeg(stored_image, 80)
    thumb = _encode_jpeg(_resize_long_edge(stored_image, 480), 74)
    return data, thumb, stored_image.width, stored_image.height


def _png_bytes(image: Image.Image) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def load_seed_points(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def seed_database(db: Session, storage: Storage, settings: Settings) -> SeedResult:
    result = SeedResult()
    payload = load_seed_points(settings.seed_path)

    for entry in payload.get("points", []):
        point = db.scalar(select(Point).where(Point.slug == entry["slug"]))
        if point is None:
            point = Point(
                slug=entry["slug"],
                type=entry["type"],
                name_i18n=entry["name_i18n"],
                description_i18n=entry["description_i18n"],
                safety_note_i18n=entry["safety_note_i18n"],
                lat=float(entry["lat"]),
                lon=float(entry["lon"]),
                elevation_m=entry.get("elevation_m"),
                coords_verified=bool(entry.get("coords_verified", False)),
            )
            db.add(point)
            db.flush()
            result.points_created += 1
        else:
            point.type = entry["type"]
            point.name_i18n = entry["name_i18n"]
            point.description_i18n = entry["description_i18n"]
            point.safety_note_i18n = entry["safety_note_i18n"]
            point.lat = float(entry["lat"])
            point.lon = float(entry["lon"])
            point.elevation_m = entry.get("elevation_m")
            point.coords_verified = bool(entry.get("coords_verified", False))
            result.points_updated += 1

        for viewpoint_entry in entry.get("viewpoints", []):
            viewpoint = db.get(Viewpoint, viewpoint_entry["id"])
            if viewpoint is None:
                viewpoint = Viewpoint(
                    id=viewpoint_entry["id"],
                    point_id=point.id,
                    heading_deg=viewpoint_entry.get("heading_deg"),
                    note_i18n=viewpoint_entry.get("note_i18n", {}),
                    reference_photo=viewpoint_entry.get("reference_photo"),
                )
                db.add(viewpoint)
            else:
                viewpoint.point_id = point.id
                viewpoint.heading_deg = viewpoint_entry.get("heading_deg")
                viewpoint.note_i18n = viewpoint_entry.get("note_i18n", {})
                if viewpoint_entry.get("reference_photo"):
                    viewpoint.reference_photo = viewpoint_entry["reference_photo"]
            db.flush()
            result.viewpoints += 1

            if settings.seed_references:
                key = viewpoint.reference_photo or f"references/{viewpoint.id}.jpg"
                if not storage.exists(key):
                    reference = render_reference_scene(point, viewpoint)
                    from .services.images import _encode_jpeg, _resize_long_edge

                    encoded = _encode_jpeg(_resize_long_edge(reference.convert("RGB"), 1600), 84)
                    storage.save(key, encoded)
                    result.references += 1
                viewpoint.reference_photo = key
            else:
                viewpoint.reference_photo = None

        db.commit()

        if settings.seed_demo:
            result.demo_photos += _seed_demo_photos(db, storage, settings, point)

    db.commit()
    return result


def _seed_demo_photos(db: Session, storage: Storage, settings: Settings, point: Point) -> int:
    created = 0
    count = max(0, settings.demo_photos_per_point)
    for index in range(count):
        year = DEMO_START_YEAR + index
        client_uuid = f"demo:{point.slug}:{year}"
        existing = db.scalar(select(Photo).where(Photo.client_uuid == client_uuid))
        key = f"demo/{point.slug}/{year}.jpg"
        thumb_key = f"demo/{point.slug}/{year}-thumb.jpg"
        if existing is not None and storage.exists(key):
            continue

        scene = render_demo_scene(point, year)
        data, thumb, width, height = _encode_scene(scene)
        storage.save(key, data)
        storage.save(thumb_key, thumb)

        rng = random.Random(f"tags:{point.slug}:{year}")
        tags = {
            "demo": True,
            "weather": rng.choice(WEATHER),
            "visibility": rng.choice(VISIBILITY),
            "snow_cover": rng.choice(SNOW_COVER),
            "automation": {
                "demo": True,
                "exif_stripped": True,
                "faces_blurred": 0,
                "source_format": "SYNTHETIC",
            },
        }
        viewpoint = db.scalar(
            select(Viewpoint).where(Viewpoint.point_id == point.id).order_by(Viewpoint.id)
        )
        taken_at = datetime(year, 8, 12, 8, 0, 0)
        photo_id = str(uuid.uuid5(DEMO_NAMESPACE, client_uuid))
        if existing is None:
            photo = Photo(
                id=photo_id,
                point_id=point.id,
                viewpoint_id=viewpoint.id if viewpoint else None,
                client_uuid=client_uuid,
                taken_at=taken_at,
                uploaded_at=utcnow(),
                width=width,
                height=height,
                bytes=len(data),
                license="CC-BY-4.0",
                tags=tags,
                phash=compute_phash(scene),
                status="published",
                file_path=key,
                thumb_path=thumb_key,
            )
            db.add(photo)
            created += 1
        else:
            existing.file_path = key
            existing.thumb_path = thumb_key
            existing.bytes = len(data)
            existing.width = width
            existing.height = height
            existing.taken_at = taken_at
            existing.tags = tags
            existing.phash = compute_phash(scene)
            existing.status = "published"
        db.commit()
        logger.info("Seeded demo photo %s (%s)", client_uuid, point.slug)
    return created


def main() -> None:
    import argparse

    from .db import init_database, make_engine, make_session_factory

    parser = argparse.ArgumentParser(description="Seed Muzdyq points and demo photos")
    parser.add_argument("--no-demo", action="store_true", help="Only seed points/references")
    parser.add_argument("--no-references", action="store_true", help="Skip reference images")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    settings = Settings()
    if args.no_demo:
        settings.seed_demo = False
    if args.no_references:
        settings.seed_references = False
    engine = make_engine(settings.database_url)
    init_database(engine, settings)
    factory = make_session_factory(engine)
    from .services.storage import build_storage

    storage = build_storage(settings)
    with factory() as session:
        result = seed_database(session, storage, settings)
    print(
        f"Seeded: {result.points_created} new points, {result.points_updated} updated, "
        f"{result.viewpoints} viewpoints, {result.references} references, "
        f"{result.demo_photos} demo photos."
    )


if __name__ == "__main__":  # pragma: no cover
    main()
