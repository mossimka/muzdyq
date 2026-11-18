from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration.

    Every value can be overridden with an environment variable of the same name
    (case-insensitive), e.g. ``DATABASE_URL`` or ``MEDIA_ROOT``.
    """

    app_name: str = "Muzdyq API"
    version: str = "0.1.0"
    environment: str = "development"

    database_url: str = "sqlite:///./data/muzdyq.db"
    media_root: Path = Path("./data/media")
    auto_create_schema: bool = True
    seed_on_startup: bool = True
    seed_demo: bool = True
    seed_references: bool = True
    demo_photos_per_point: int = 5
    seed_path: Path = BACKEND_DIR / "seed" / "points.json"

    admin_token: str = "dev-admin-token-change-me"
    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173"
    public_base_url: str = ""

    # Uploads
    max_upload_bytes: int = 15 * 1024 * 1024
    max_image_long_edge: int = 2048
    thumb_long_edge: int = 480
    jpeg_quality: int = 85
    thumb_quality: int = 78
    duplicate_phash_distance: int = 3
    upload_limit_per_hour: int = 40
    upload_limit_per_minute: int = 6
    ip_hash_salt: str = "dev-salt-change-me"
    trust_proxy_headers: bool = False

    # Optional S3-compatible storage. Local disk is the default.
    storage_backend: str = "local"
    s3_bucket: str = ""
    s3_prefix: str = "muzdyq/"
    s3_endpoint_url: str = ""
    s3_region: str = "us-east-1"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""

    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def using_default_admin_token(self) -> bool:
        return self.admin_token == "dev-admin-token-change-me"

    @property
    def using_default_salt(self) -> bool:
        return self.ip_hash_salt == "dev-salt-change-me"


@lru_cache
def get_settings() -> Settings:
    return Settings()
