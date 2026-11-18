from __future__ import annotations

import csv
import io
import json
import tempfile
import zipfile
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import get_db
from ..models import Photo, Point
from ..serializers import photo_to_public
from ..services.storage import Storage
from ..utils import iso_z, parse_bound, utcnow
from .deps import get_app_settings, get_point_or_404, get_storage

router = APIRouter(prefix="/api/export", tags=["export"])

LICENSE = "CC-BY-4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION = "Muzdyq Citizen Science Photo Archive, CC BY 4.0"
DISCLAIMER = (
    "Citizen photos are observations, not measurements. Conclusions about glacier "
    "state require verification by scientists."
)

CSV_COLUMNS = [
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
]


def _license_headers() -> dict[str, str]:
    return {
        "X-Data-License": LICENSE,
        "Link": f'<{LICENSE_URL}>; rel="license"',
        "X-Content-Type-Options": "nosniff",
    }


def _absolute_base(request: Request, settings: Settings) -> str:
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    return str(request.base_url).rstrip("/")


def _fetch_photos(
    db: Session,
    *,
    point_slug: str | None,
    from_: str | None,
    to: str | None,
) -> tuple[list[tuple[Photo, Point]], Point | None]:
    point = get_point_or_404(db, point_slug) if point_slug else None
    try:
        start = parse_bound(from_)
        end = parse_bound(to, end=True)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date range") from exc

    stmt = (
        select(Photo, Point)
        .join(Point, Photo.point_id == Point.id)
        .where(Photo.status == "published")
        .order_by(Photo.taken_at.asc(), Photo.id.asc())
    )
    if point is not None:
        stmt = stmt.where(Photo.point_id == point.id)
    if start:
        stmt = stmt.where(Photo.taken_at >= start)
    if end:
        stmt = stmt.where(Photo.taken_at <= end)
    rows = [(photo, row_point) for photo, row_point in db.execute(stmt).all()]
    return rows, point


def _csv_text(rows: list[tuple[Photo, Point]], base: str) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    for photo, point in rows:
        tags = photo.tags or {}
        public = photo_to_public(photo, point.slug, base)
        writer.writerow(
            {
                "photo_id": photo.id,
                "point_slug": point.slug,
                "point_name_en": (point.name_i18n or {}).get("en", point.slug),
                "point_type": point.type,
                "viewpoint_id": photo.viewpoint_id or "",
                "taken_at": iso_z(photo.taken_at),
                "uploaded_at": iso_z(photo.uploaded_at),
                "lat": point.lat,
                "lon": point.lon,
                "elevation_m": point.elevation_m or "",
                "width": photo.width,
                "height": photo.height,
                "bytes": photo.bytes,
                "license": photo.license,
                "weather": tags.get("weather", ""),
                "visibility": tags.get("visibility", ""),
                "snow_cover": tags.get("snow_cover", ""),
                "is_demo": bool(tags.get("demo")),
                "photo_url": public["url"],
                "thumb_url": public["thumb_url"],
            }
        )
    return buffer.getvalue()


def _feature(photo: Photo, point: Point, base: str) -> dict[str, Any]:
    tags = photo.tags or {}
    public = photo_to_public(photo, point.slug, base)
    return {
        "type": "Feature",
        "id": photo.id,
        "geometry": {
            "type": "Point",
            # ONLY the hardcoded monitoring point is published. Never device GPS.
            "coordinates": [point.lon, point.lat],
        },
        "properties": {
            "photo_id": photo.id,
            "point_slug": point.slug,
            "point_name_i18n": point.name_i18n,
            "point_type": point.type,
            "viewpoint_id": photo.viewpoint_id,
            "taken_at": public["taken_at"],
            "uploaded_at": public["uploaded_at"],
            "width": photo.width,
            "height": photo.height,
            "bytes": photo.bytes,
            "license": photo.license,
            "weather": tags.get("weather"),
            "visibility": tags.get("visibility"),
            "snow_cover": tags.get("snow_cover"),
            "is_demo": bool(tags.get("demo")),
            "phash": photo.phash,
            "coords_verified": point.coords_verified,
            "coordinate_source": "hardcoded_monitoring_point",
            "photo_url": public["url"],
            "thumb_url": public["thumb_url"],
        },
    }


def _geojson(rows: list[tuple[Photo, Point]], base: str) -> str:
    payload = {
        "type": "FeatureCollection",
        "name": "muzdyq-photos",
        "license": LICENSE,
        "license_url": LICENSE_URL,
        "attribution": ATTRIBUTION,
        "disclaimer": DISCLAIMER,
        "generated_at": iso_z(utcnow()),
        "features": [_feature(photo, point, base) for photo, point in rows],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _json_text(rows: list[tuple[Photo, Point]], base: str) -> str:
    photos = []
    for photo, point in rows:
        item = photo_to_public(photo, point.slug, base)
        item.update(
            {
                "point_name_i18n": point.name_i18n,
                "point_type": point.type,
                "lat": point.lat,
                "lon": point.lon,
                "elevation_m": point.elevation_m,
                "coords_verified": point.coords_verified,
                "coordinate_source": "hardcoded_monitoring_point",
                "phash": photo.phash,
            }
        )
        photos.append(item)
    payload = {
        "name": "muzdyq-photos",
        "license": LICENSE,
        "license_url": LICENSE_URL,
        "attribution": ATTRIBUTION,
        "disclaimer": DISCLAIMER,
        "generated_at": iso_z(utcnow()),
        "count": len(photos),
        "photos": photos,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _filename(prefix: str, extension: str, point: Point | None) -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d")
    if point is not None:
        return f"muzdyq-{point.slug}-{stamp}.{extension}"
    return f"muzdyq-{prefix}-{stamp}.{extension}"


@router.get("/photos.csv", summary="Export published photo metadata as CSV (no auth)")
def export_csv(
    request: Request,
    point: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    rows, point_obj = _fetch_photos(db, point_slug=point, from_=from_, to=to)
    base = _absolute_base(request, settings)
    text = _csv_text(rows, base)
    headers = {
        **_license_headers(),
        "Content-Disposition": f'attachment; filename="{_filename("photos", "csv", point_obj)}"',
    }
    return Response(content=text, media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/photos.geojson", summary="Export published photo metadata as GeoJSON (no auth)")
def export_geojson(
    request: Request,
    point: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    rows, point_obj = _fetch_photos(db, point_slug=point, from_=from_, to=to)
    base = _absolute_base(request, settings)
    headers = {
        **_license_headers(),
        "Content-Disposition": (
            f'attachment; filename="{_filename("photos", "geojson", point_obj)}"'
        ),
    }
    return Response(
        content=_geojson(rows, base),
        media_type="application/geo+json; charset=utf-8",
        headers=headers,
    )


@router.get("/photos.json", summary="Export published photo metadata as JSON (no auth)")
def export_json(
    request: Request,
    point: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    rows, point_obj = _fetch_photos(db, point_slug=point, from_=from_, to=to)
    base = _absolute_base(request, settings)
    headers = {
        **_license_headers(),
        "Content-Disposition": f'attachment; filename="{_filename("photos", "json", point_obj)}"',
    }
    return Response(
        content=_json_text(rows, base),
        media_type="application/json; charset=utf-8",
        headers=headers,
    )


LICENSE_TEXT = f"""Muzdyq — citizen-science glacier and water photo archive
================================================================

License: Creative Commons Attribution 4.0 International ({LICENSE})
License URL: {LICENSE_URL}

Attribution: {ATTRIBUTION}

DISCLAIMER
----------
{DISCLAIMER}

Coordinates in the metadata are the hardcoded monitoring-point coordinates.
They are NOT the photographer's location. Source photos contain no EXIF or GPS
data. Faces detected by the server are blurred before publication.

Some images in a development/demo export are synthetic placeholders and are
marked "is_demo" in metadata.csv. Do not use demo images as evidence.
"""


def _zip_bytes(
    rows: list[tuple[Photo, Point]], base: str, storage: Storage
) -> Any:
    temp = tempfile.SpooledTemporaryFile(max_size=64 * 1024 * 1024)  # noqa: SIM115
    with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("metadata.csv", _csv_text(rows, base))
        archive.writestr("metadata.json", _json_text(rows, base))
        archive.writestr("photos.geojson", _geojson(rows, base))
        archive.writestr("LICENSE.txt", LICENSE_TEXT)
        for photo, point in rows:
            try:
                data = storage.read(photo.file_path)
            except FileNotFoundError:
                continue
            suffix = ".jpg"
            archive.writestr(f"images/{point.slug}/{photo.id}{suffix}", data)
    temp.seek(0)
    return temp


@router.get("/photos.zip", summary="Download a ZIP of published images + metadata (no auth)")
def export_zip(
    request: Request,
    point: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    storage: Storage = Depends(get_storage),
) -> StreamingResponse:
    rows, point_obj = _fetch_photos(db, point_slug=point, from_=from_, to=to)
    base = _absolute_base(request, settings)
    temp = _zip_bytes(rows, base, storage)

    async def iterator() -> AsyncIterator[bytes]:
        try:
            while True:
                chunk = temp.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            temp.close()

    headers = {
        **_license_headers(),
        "Content-Disposition": f'attachment; filename="{_filename("photos", "zip", point_obj)}"',
    }
    return StreamingResponse(iterator(), media_type="application/zip", headers=headers)
