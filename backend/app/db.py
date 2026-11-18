from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

from fastapi import Request
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import Settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str) -> Engine:
    kwargs: dict[str, Any] = {"pool_pre_ping": True, "future": True}
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(database_url, **kwargs)

    if database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_database(engine: Engine, settings: Settings) -> None:
    if settings.auto_create_schema:
        # Import models so they are registered on Base.metadata.
        from . import models  # noqa: F401

        Base.metadata.create_all(engine)

    if engine.dialect.name == "postgresql":
        # PostGIS is used for optional spatial analysis. The portable ORM keeps
        # lat/lon columns so SQLite remains a first-class development fallback.
        try:
            with engine.begin() as connection:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        except Exception as exc:  # pragma: no cover - depends on DB privileges
            logger.warning("Could not enable PostGIS extension: %s", exc)


def get_db(request: Request) -> Iterator[Session]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    session = factory()
    try:
        yield session
    finally:
        session.close()
