from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PHOTO_STATUSES, Photo
from ..schemas import AdminPhotoListOut, AdminPhotoOut, AdminStatusIn
from ..serializers import photo_to_public
from ..services.storage import Storage
from .deps import get_storage, require_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


def _admin_payload(photo: Photo) -> dict:
    payload = photo_to_public(photo, photo.point.slug)
    payload["status"] = photo.status
    payload["rejection_reason"] = photo.rejection_reason
    return payload


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


@router.get("/photos", response_model=AdminPhotoListOut, summary="Moderation queue")
def list_admin_photos(
    response: Response,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict:
    _no_store(response)
    if status is not None and status not in PHOTO_STATUSES:
        raise HTTPException(status_code=422, detail="Unknown status filter")
    stmt = select(Photo).order_by(Photo.uploaded_at.desc()).limit(limit)
    total_stmt = select(func.count(Photo.id))
    if status:
        stmt = stmt.where(Photo.status == status)
        total_stmt = total_stmt.where(Photo.status == status)
    photos = db.scalars(stmt).all()
    total = int(db.scalar(total_stmt) or 0)
    return {"items": [_admin_payload(p) for p in photos], "total": total}


@router.get("/stats", summary="Moderation counts")
def admin_stats(response: Response, db: Session = Depends(get_db)) -> dict:
    _no_store(response)
    rows = db.execute(select(Photo.status, func.count(Photo.id)).group_by(Photo.status)).all()
    counts = dict.fromkeys(PHOTO_STATUSES, 0)
    for status, count in rows:
        counts[status] = int(count)
    return {"statuses": counts, "total": sum(counts.values())}


@router.post("/photos/{photo_id}/hide", response_model=AdminPhotoOut, summary="Hide a photo")
def hide_photo(
    photo_id: str,
    response: Response,
    payload: AdminStatusIn | None = None,
    db: Session = Depends(get_db),
) -> dict:
    _no_store(response)
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.status = "hidden"
    photo.rejection_reason = (payload.reason if payload else None) or "Hidden by moderator"
    db.commit()
    db.refresh(photo)
    return _admin_payload(photo)


@router.post(
    "/photos/{photo_id}/publish", response_model=AdminPhotoOut, summary="Re-publish a photo"
)
def publish_photo(
    photo_id: str,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    _no_store(response)
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.status = "published"
    photo.rejection_reason = None
    db.commit()
    db.refresh(photo)
    return _admin_payload(photo)


@router.delete("/photos/{photo_id}", status_code=204, summary="Permanently delete a photo")
def delete_photo(
    photo_id: str,
    response: Response,
    db: Session = Depends(get_db),
    storage: Storage = Depends(get_storage),
) -> Response:
    _no_store(response)
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    storage.delete(photo.file_path)
    storage.delete(photo.thumb_path)
    db.delete(photo)
    db.commit()
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
