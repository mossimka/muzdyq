from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .api import admin, export, health, photos, points
from .config import Settings
from .db import init_database, make_engine, make_session_factory
from .seed import seed_database
from .services.ratelimit import RateLimiter
from .services.storage import build_storage
from .utils import iso_z, utcnow

logger = logging.getLogger(__name__)

OPENAPI_TAGS = [
    {"name": "points", "description": "Fixed monitoring points and viewpoints."},
    {"name": "photos", "description": "Upload and retrieve citizen photos. No accounts."},
    {"name": "export", "description": "Open data exports (CC BY 4.0), no authentication."},
    {"name": "admin", "description": "Token-protected moderation. Never exposed to contributors."},
    {"name": "health", "description": "Operational health."},
]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if settings.using_default_admin_token:
        logger.warning(
            "ADMIN_TOKEN is the development default. Set a strong random value before deployment."
        )
    if settings.using_default_salt:
        logger.warning(
            "IP_HASH_SALT is the development default. Rotate it before deployment."
        )

    engine = make_engine(settings.database_url)
    session_factory = make_session_factory(engine)
    storage = build_storage(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
        init_database(engine, settings)
        if settings.seed_on_startup:
            with session_factory() as session:
                result = seed_database(session, storage, settings)
                logger.info(
                    "Seed ready: %s points, %s viewpoints, %s demo photos",
                    result.points_created + result.points_updated,
                    result.viewpoints,
                    result.demo_photos,
                )
        yield
        engine.dispose()

    app = FastAPI(
        title="Muzdyq API",
        version=settings.version,
        description=(
            "Open, account-free citizen-science photo archive for glaciers and water "
            "bodies of the Ile Alatau. Photo data is licensed CC BY 4.0; code is MIT. "
            "Citizen photos are observations, not measurements."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=OPENAPI_TAGS,
        license_info={"name": "MIT (code) / CC BY 4.0 (data)", "url": "https://opensource.org/license/mit"},
        contact={"name": "Muzdyq contributors", "url": "https://github.com/muzdyq/muzdyq"},
        lifespan=lifespan,
    )

    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.storage = storage
    app.state.rate_limiter = RateLimiter()

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Device-Token", "X-Admin-Token"],
        expose_headers=[
            "Content-Disposition",
            "X-Data-License",
            "X-Idempotent-Replay",
            "X-Photo-Status",
            "Link",
            "Retry-After",
        ],
        max_age=600,
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=(self)"
        )
        return response

    app.include_router(points.router)
    app.include_router(photos.router)
    app.include_router(export.router)
    app.include_router(admin.router)
    app.include_router(health.router)

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {
            "name": "Muzdyq API",
            "version": settings.version,
            "time": iso_z(utcnow()),
            "docs": "/docs",
            "health": "/api/health",
            "license": {"code": "MIT", "data": "CC-BY-4.0"},
            "account_required": False,
            "disclaimer": (
                "Citizen photos are observations, not measurements. Conclusions about "
                "glacier state require verification by scientists."
            ),
        }

    @app.get("/api", include_in_schema=False)
    def api_index() -> dict:
        return {
            "points": "/api/points",
            "exports": {
                "csv": "/api/export/photos.csv",
                "geojson": "/api/export/photos.geojson",
                "json": "/api/export/photos.json",
                "zip": "/api/export/photos.zip",
            },
            "docs": "/docs",
        }

    return app


app = create_app()
