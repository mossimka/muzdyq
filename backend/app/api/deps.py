"""API helpers and dependencies."""

from __future__ import annotations

import secrets

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import get_db
from ..models import Point
from ..services.storage import Storage


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_storage(request: Request) -> Storage:
    return request.app.state.storage


def get_rate_limiter(request: Request):  # type: ignore[no-untyped-def]
    return request.app.state.rate_limiter

def get_request_ip(request: Request, settings: Settings) -> str:
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_point_or_404(db: Session, slug: str) -> Point:
    point = db.scalar(select(Point).where(Point.slug == slug))
    if point is None:
        raise HTTPException(status_code=404, detail=f"Unknown monitoring point: {slug}")
    return point


def require_admin(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
    settings: Settings = Depends(get_app_settings),
) -> None:
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if not secrets.compare_digest(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=403, detail="Invalid admin token")


__all__ = [
    "get_app_settings",
    "get_point_or_404",
    "get_rate_limiter",
    "get_request_ip",
    "get_storage",
    "get_db",
    "require_admin",
]
