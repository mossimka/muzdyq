from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Photo, Point
from .utils import iso_z


def photo_urls(photo_id: str) -> dict[str, str]:
    base = f"/api/photos/{photo_id}"
    return {
        "url": f"{base}/file",
        "thumb_url": f"{base}/thumb",
        "download_url": f"{base}/file?download=1",
    }


def photo_to_public(photo: Photo, point_slug: str, absolute_base: str = "") -> dict:
    prefix = absolute_base.rstrip("/") if absolute_base else ""
    urls = {key: f"{prefix}{value}" for key, value in photo_urls(photo.id).items()}
    return {
        "id": photo.id,
        "point_id": photo.point_id,
        "point_slug": point_slug,
        "viewpoint_id": photo.viewpoint_id,
        "taken_at": iso_z(photo.taken_at),
        "uploaded_at": iso_z(photo.uploaded_at),
        "width": photo.width,
        "height": photo.height,
        "bytes": photo.bytes,
        "license": photo.license,
        "tags": photo.tags or {},
        "is_demo": bool((photo.tags or {}).get("demo")),
        **urls,
    }


def point_to_public(
    point: Point,
    *,
    photo_count: int = 0,
    latest_photo: Photo | None = None,
    demo: bool = False,
    absolute_base: str = "",
) -> dict:
    prefix = absolute_base.rstrip("/") if absolute_base else ""
    viewpoints = []
    for viewpoint in point.viewpoints:
        reference_url = None
        if viewpoint.reference_photo:
            reference_url = f"{prefix}/api/viewpoints/{viewpoint.id}/reference"
        viewpoints.append(
            {
                "id": viewpoint.id,
                "heading_deg": viewpoint.heading_deg,
                "note_i18n": viewpoint.note_i18n or {},
                "reference_photo_url": reference_url,
            }
        )
    latest_at = iso_z(latest_photo.taken_at) if latest_photo else None
    latest_thumb = (
        f"{prefix}/api/photos/{latest_photo.id}/thumb" if latest_photo else None
    )
    return {
        "id": point.id,
        "slug": point.slug,
        "type": point.type,
        "name_i18n": point.name_i18n or {},
        "description_i18n": point.description_i18n or {},
        "safety_note_i18n": point.safety_note_i18n or {},
        "lat": point.lat,
        "lon": point.lon,
        "elevation_m": point.elevation_m,
        "coords_verified": point.coords_verified,
        "viewpoints": viewpoints,
        "photo_count": photo_count,
        "latest_photo_at": latest_at,
        "latest_thumb_url": latest_thumb,
        "demo": demo,
    }


def point_stats(db: Session, point_id: int) -> tuple[int, Photo | None, bool]:
    count = (
        db.scalar(
            select(func.count(Photo.id)).where(
                Photo.point_id == point_id, Photo.status == "published"
            )
        )
        or 0
    )
    latest = db.scalars(
        select(Photo)
        .where(Photo.point_id == point_id, Photo.status == "published")
        .order_by(Photo.taken_at.desc(), Photo.id.desc())
        .limit(1)
    ).first()
    demo = bool(
        db.scalar(
            select(func.count(Photo.id)).where(
                Photo.point_id == point_id,
                Photo.status == "published",
                Photo.client_uuid.like("demo:%"),
            )
        )
    )
    return int(count), latest, demo
