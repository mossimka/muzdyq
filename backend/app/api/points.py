from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Point
from ..schemas import PointOut
from ..serializers import point_stats, point_to_public
from .deps import get_point_or_404

router = APIRouter(prefix="/api", tags=["points"])


@router.get("/points", response_model=list[PointOut], summary="List monitoring points")
def list_points(db: Session = Depends(get_db)) -> list[dict]:
    points = db.scalars(select(Point).order_by(Point.id)).all()
    payload = []
    for point in points:
        count, latest, demo = point_stats(db, point.id)
        payload.append(
            point_to_public(point, photo_count=count, latest_photo=latest, demo=demo)
        )
    return payload


@router.get("/points/{slug}", response_model=PointOut, summary="Get one monitoring point")
def get_point(slug: str, db: Session = Depends(get_db)) -> dict:
    point = get_point_or_404(db, slug)
    count, latest, demo = point_stats(db, point.id)
    return point_to_public(point, photo_count=count, latest_photo=latest, demo=demo)
