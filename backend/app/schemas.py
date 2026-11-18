from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

PointType = Literal["glacier", "water"]
Locale = Literal["en", "ru", "kk"]


class ViewpointOut(BaseModel):
    id: str
    heading_deg: int | None = None
    note_i18n: dict[str, str] = Field(default_factory=dict)
    reference_photo_url: str | None = None


class PointOut(BaseModel):
    id: int
    slug: str
    type: PointType
    name_i18n: dict[str, str]
    description_i18n: dict[str, str]
    safety_note_i18n: dict[str, str]
    lat: float
    lon: float
    elevation_m: int | None = None
    coords_verified: bool
    viewpoints: list[ViewpointOut] = Field(default_factory=list)
    photo_count: int = 0
    latest_photo_at: str | None = None
    latest_thumb_url: str | None = None
    demo: bool = False


class PhotoOut(BaseModel):
    id: str
    point_id: int
    point_slug: str
    viewpoint_id: str | None = None
    taken_at: str
    uploaded_at: str
    width: int
    height: int
    bytes: int
    license: str = "CC-BY-4.0"
    tags: dict[str, Any] = Field(default_factory=dict)
    is_demo: bool = False
    url: str
    thumb_url: str
    download_url: str


class PhotoListOut(BaseModel):
    items: list[PhotoOut]
    next_cursor: str | None = None


class UploadOut(BaseModel):
    photo: PhotoOut
    duplicate: bool = False


class AdminPhotoOut(PhotoOut):
    status: str
    rejection_reason: str | None = None


class AdminPhotoListOut(BaseModel):
    items: list[AdminPhotoOut]
    total: int


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    time: str
    database: Literal["ok", "error"]
    storage: Literal["ok", "error"]
    counts: dict[str, int] = Field(default_factory=dict)
    face_detection: dict[str, Any] = Field(default_factory=dict)


class ErrorOut(BaseModel):
    detail: str
    code: str | None = None


class AdminStatusIn(BaseModel):
    reason: str | None = None
