from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import get_db
from ..models import Photo, Point, Viewpoint
from ..schemas import HealthOut
from ..services import faces
from ..services.storage import Storage
from ..utils import iso_z, utcnow
from .deps import get_app_settings, get_storage

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health", response_model=HealthOut, summary="Service health and counts")
def health(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    storage: Storage = Depends(get_storage),
) -> dict:
    database = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database = "error"

    storage_status = "ok"
    probe = f".health/{uuid.uuid4().hex}.probe"
    try:
        storage.save(probe, b"ok")
        if storage.read(probe) != b"ok":
            storage_status = "error"
        storage.delete(probe)
    except Exception:
        storage_status = "error"

    counts = {
        "points": int(db.scalar(select(func.count(Point.id))) or 0),
        "viewpoints": int(db.scalar(select(func.count(Viewpoint.id))) or 0),
        "photos": int(db.scalar(select(func.count(Photo.id))) or 0),
        "published": int(
            db.scalar(select(func.count(Photo.id)).where(Photo.status == "published")) or 0
        ),
    }
    status = "ok" if database == "ok" and storage_status == "ok" else "degraded"
    face_status = faces.model_status()

    return {
        "status": status,
        "version": settings.version,
        "time": iso_z(utcnow()) or "",
        "database": database,
        "storage": storage_status,
        "counts": counts,
        "face_detection": {
            "available": bool(face_status["yunet"] or face_status["haar_cascade"]),
            "engine": "yunet"
            if face_status["yunet"]
            else ("haar_cascade" if face_status["haar_cascade"] else "none"),
        },
    }
