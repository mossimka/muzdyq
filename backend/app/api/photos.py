from __future__ import annotations

import base64
import binascii
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import get_db
from ..models import Photo, Viewpoint
from ..schemas import PhotoListOut, UploadOut
from ..serializers import photo_to_public
from ..services.images import (
    ImageValidationError,
    UnsupportedImageType,
    process_upload,
)
from ..services.phash import hamming_distance
from ..services.ratelimit import RateLimiter
from ..services.storage import Storage
from ..utils import (
    ensure_utc,
    hash_device_token,
    hash_ip,
    iso_z,
    parse_bound,
    parse_client_datetime,
    round_down_to_hour,
    utcnow,
)
from .deps import get_app_settings, get_point_or_404, get_rate_limiter, get_request_ip, get_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["photos"])

ALLOWED_TAGS: dict[str, set[str]] = {
    "weather": {"clear", "partly_cloudy", "overcast", "fog", "rain", "snow"},
    "visibility": {"good", "medium", "poor"},
    "snow_cover": {"none", "partial", "full"},
}


def _encode_cursor(photo: Photo) -> str:
    raw = f"{iso_z(photo.taken_at)}|{photo.id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        timestamp, photo_id = raw.split("|", 1)
        return parse_client_datetime(timestamp), photo_id
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=422, detail="Invalid cursor") from exc


def _clean_tags(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    if len(raw) > 2000:
        raise HTTPException(status_code=422, detail="Tags payload is too large")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Tags must be valid JSON") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="Tags must be a JSON object")
    clean: dict[str, str] = {}
    for key, allowed in ALLOWED_TAGS.items():
        value = parsed.get(key)
        if isinstance(value, str) and value in allowed:
            clean[key] = value
    return clean


@router.get(
    "/points/{slug}/photos",
    response_model=PhotoListOut,
    summary="List published photos for a point",
)
def list_photos(
    slug: str,
    from_: str | None = Query(default=None, alias="from", description="ISO date or year"),
    to: str | None = Query(default=None, description="ISO date or year"),
    year: int | None = Query(default=None, ge=1900, le=2100),
    limit: int = Query(default=24, ge=1, le=100),
    cursor: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    point = get_point_or_404(db, slug)

    try:
        start = parse_bound(from_ or (str(year) if year else None))
        end = parse_bound(to or (str(year) if year else None), end=True)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date range") from exc

    stmt = (
        select(Photo)
        .where(Photo.point_id == point.id, Photo.status == "published")
        .order_by(Photo.taken_at.desc(), Photo.id.desc())
    )
    if start:
        stmt = stmt.where(Photo.taken_at >= start)
    if end:
        stmt = stmt.where(Photo.taken_at <= end)

    if cursor:
        cursor_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Photo.taken_at < cursor_at,
                and_(Photo.taken_at == cursor_at, Photo.id < cursor_id),
            )
        )

    rows = list(db.scalars(stmt.limit(limit + 1)).all())
    next_cursor = _encode_cursor(rows[limit - 1]) if len(rows) > limit else None
    items = rows[:limit]
    return {
        "items": [photo_to_public(photo, point.slug) for photo in items],
        "next_cursor": next_cursor,
    }


def _replay_response(
    photo: Photo, response: Response, *, status_code: int = 200
) -> dict:
    response.status_code = status_code
    response.headers["X-Idempotent-Replay"] = "true"
    return {
        "photo": photo_to_public(photo, photo.point.slug),
        "duplicate": True,
    }


@router.post(
    "/points/{slug}/photos",
    response_model=UploadOut,
    status_code=201,
    summary="Upload a citizen photo (no account required)",
    responses={
        200: {"description": "Idempotent replay of an existing upload"},
        409: {"description": "Near-duplicate image or client UUID conflict"},
        413: {"description": "File too large"},
        415: {"description": "Unsupported image type"},
        429: {"description": "Rate limit exceeded"},
    },
)
def upload_photo(
    request: Request,
    response: Response,
    slug: str,
    file: UploadFile = File(...),
    viewpoint_id: str = Form(...),
    taken_at: str = Form(...),
    client_uuid: str = Form(...),
    tags: str = Form(default="{}"),
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    storage: Storage = Depends(get_storage),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> dict:
    point = get_point_or_404(db, slug)

    try:
        canonical_uuid = str(uuid.UUID(client_uuid))
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=422, detail="client_uuid must be a UUID") from exc

    existing = db.scalar(select(Photo).where(Photo.client_uuid == canonical_uuid))
    if existing is not None:
        if existing.point_id != point.id:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "client_uuid_conflict",
                    "message": "This client UUID was already used for another point.",
                },
            )
        return _replay_response(existing, response)

    viewpoint = db.get(Viewpoint, viewpoint_id)
    if viewpoint is None or viewpoint.point_id != point.id:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_viewpoint",
                "message": "Photos are only accepted from predefined viewpoints of this point.",
            },
        )

    ip_hash = hash_ip(get_request_ip(request, settings), settings.ip_hash_salt)
    device_hash = hash_device_token(x_device_token, settings.ip_hash_salt)
    limiter_key = f"upload:{ip_hash}:{device_hash or 'no-device'}"
    allowed, retry_after = limiter.consume(
        f"{limiter_key}:minute", settings.upload_limit_per_minute, 60
    )
    if allowed:
        allowed, retry_after = limiter.consume(
            f"{limiter_key}:hour", settings.upload_limit_per_hour, 3600
        )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Upload rate limit reached. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        raw = file.file.read(settings.max_upload_bytes + 1)
    finally:
        file.file.close()

    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than {settings.max_upload_bytes // (1024 * 1024)} MB",
        )
    if not raw:
        raise HTTPException(status_code=422, detail="Empty upload")

    try:
        processed = process_upload(
            raw,
            file.content_type,
            max_long_edge=settings.max_image_long_edge,
            quality=settings.jpeg_quality,
            thumb_long_edge=settings.thumb_long_edge,
            thumb_quality=settings.thumb_quality,
        )
    except UnsupportedImageType as exc:
        raise HTTPException(
            status_code=415, detail={"code": "unsupported_type", "message": str(exc)}
        ) from exc
    except ImageValidationError as exc:
        raise HTTPException(
            status_code=422, detail={"code": "invalid_image", "message": str(exc)}
        ) from exc

    try:
        client_taken_at = parse_client_datetime(taken_at)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422, detail="taken_at must be an ISO-8601 timestamp with timezone"
        ) from exc

    # Never trust EXIF. The client supplies the capture time; round it to the
    # hour to reduce the precision of any personal movement pattern.
    taken_at_rounded = round_down_to_hour(client_taken_at)
    now = utcnow()
    if taken_at_rounded < datetime(2000, 1, 1) or taken_at_rounded > now + timedelta(hours=6):
        raise HTTPException(status_code=422, detail="taken_at is outside the accepted range")

    clean_tags = _clean_tags(tags)

    candidates = db.scalars(
        select(Photo)
        .where(
            Photo.point_id == point.id,
            Photo.phash.is_not(None),
            Photo.status.in_(("pending", "published")),
        )
        .order_by(Photo.uploaded_at.desc())
        .limit(300)
    ).all()
    for candidate in candidates:
        if hamming_distance(processed.phash, candidate.phash) <= settings.duplicate_phash_distance:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "duplicate_photo",
                    "message": "A near-identical photo already exists for this point.",
                    "existing_photo_id": candidate.id,
                },
            )

    photo_id = str(uuid.uuid4())
    year_month = f"{now.year:04d}/{now.month:02d}"
    key = f"photos/{year_month}/{photo_id}.jpg"
    thumb_key = f"thumbs/{year_month}/{photo_id}.jpg"
    storage.save(key, processed.data)
    storage.save(thumb_key, processed.thumb)

    merged_tags: dict[str, Any] = dict(clean_tags)
    merged_tags["automation"] = {
        "exif_stripped": True,
        "faces_blurred": processed.faces_blurred,
        "source_format": processed.meta.get("source_format"),
        "checks": "passed",
    }

    photo = Photo(
        id=photo_id,
        point_id=point.id,
        viewpoint_id=viewpoint.id,
        client_uuid=canonical_uuid,
        taken_at=taken_at_rounded,
        uploaded_at=now,
        width=processed.width,
        height=processed.height,
        bytes=len(processed.data),
        license="CC-BY-4.0",
        tags=merged_tags,
        phash=processed.phash,
        status="published",
        file_path=key,
        thumb_path=thumb_key,
        ip_hash=ip_hash,
        device_hash=device_hash,
    )
    db.add(photo)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        storage.delete(key)
        storage.delete(thumb_key)
        existing = db.scalar(select(Photo).where(Photo.client_uuid == canonical_uuid))
        if existing is not None:
            return _replay_response(existing, response)
        raise HTTPException(status_code=409, detail="Upload conflict; please retry") from None

    db.refresh(photo)
    response.status_code = 201
    response.headers["X-Photo-Status"] = photo.status
    logger.info(
        "Published photo %s for %s (faces blurred: %s)", photo.id, point.slug, processed.faces_blurred
    )
    return {"photo": photo_to_public(photo, point.slug), "duplicate": False}


def _serve_photo(
    db: Session,
    storage: Storage,
    photo_id: str,
    *,
    thumb: bool = False,
    download: bool = False,
) -> Response:
    photo = db.get(Photo, photo_id)
    if photo is None or photo.status != "published":
        raise HTTPException(status_code=404, detail="Photo not found")
    key = photo.thumb_path if thumb else photo.file_path
    try:
        data = storage.read(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Photo file missing") from None

    suffix = "thumb" if thumb else "photo"
    filename = f"muzdyq-{photo.point.slug}-{ensure_utc(photo.taken_at).date().isoformat()}-{suffix}.jpg"
    disposition = "attachment" if download else "inline"
    headers = {
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": f'{disposition}; filename="{filename}"',
        "X-Content-Type-Options": "nosniff",
        "X-Data-License": "CC-BY-4.0",
        "ETag": f'"{photo.id}-{suffix}"',
    }
    return Response(content=data, media_type="image/jpeg", headers=headers)


@router.get("/photos/{photo_id}/file", summary="Download a published photo (CC BY 4.0)")
def get_photo_file(
    photo_id: str,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> Response:
    return _serve_photo(db, storage, photo_id, download=download)


@router.get("/photos/{photo_id}/thumb", summary="Photo thumbnail")
def get_photo_thumb(
    photo_id: str,
    db: Session = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> Response:
    return _serve_photo(db, storage, photo_id, thumb=True)


@router.get("/viewpoints/{viewpoint_id}/reference", summary="Viewpoint reference photo")
def get_reference(
    viewpoint_id: str,
    db: Session = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> Response:
    viewpoint = db.get(Viewpoint, viewpoint_id)
    if viewpoint is None or not viewpoint.reference_photo:
        raise HTTPException(status_code=404, detail="Reference photo not available")
    try:
        data = storage.read(viewpoint.reference_photo)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Reference photo file missing") from None
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "X-Data-License": "CC-BY-4.0",
        },
    )
