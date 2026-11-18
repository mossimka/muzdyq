from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def build_settings(tmp_path: Path, **overrides) -> Settings:
    values = {
        "database_url": f"sqlite:///{tmp_path / 'test.db'}",
        "media_root": tmp_path / "media",
        "seed_demo": False,
        "seed_references": False,
        "seed_on_startup": True,
        "auto_create_schema": True,
        "admin_token": "test-admin-token",
        "ip_hash_salt": "test-salt",
        "upload_limit_per_hour": 200,
        "upload_limit_per_minute": 100,
        "log_level": "WARNING",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return build_settings(tmp_path)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_headers() -> dict[str, str]:
    return {"X-Admin-Token": "test-admin-token"}
