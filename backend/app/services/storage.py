from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Protocol

from ..config import Settings


class Storage(Protocol):
    def save(self, key: str, data: bytes) -> str: ...

    def read(self, key: str) -> bytes: ...

    def delete(self, key: str) -> None: ...

    def exists(self, key: str) -> bool: ...

    def local_path(self, key: str) -> Path | None: ...


class LocalStorage:
    """Filesystem storage rooted at ``MEDIA_ROOT`` with traversal protection."""

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        if not key or key.startswith("/") or "\\" in key:
            raise ValueError("Invalid storage key")
        candidate = (self.root / key).resolve()
        if not candidate.is_relative_to(self.root):
            raise ValueError("Storage key escapes media root")
        return candidate

    def save(self, key: str, data: bytes) -> str:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(target.suffix + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(target)
        return key

    def read(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()

    def delete(self, key: str) -> None:
        try:
            self._resolve(key).unlink(missing_ok=True)
        except ValueError:
            return

    def exists(self, key: str) -> bool:
        try:
            return self._resolve(key).is_file()
        except ValueError:
            return False

    def local_path(self, key: str) -> Path | None:
        try:
            path = self._resolve(key)
        except ValueError:
            return None
        return path if path.is_file() else None

    def healthcheck(self) -> bool:
        probe = ".healthcheck"
        try:
            self.save(probe, b"ok")
            ok = self.read(probe) == b"ok"
            self.delete(probe)
            return ok
        except Exception:
            return False


class S3Storage:
    """Optional S3-compatible adapter. Requires ``boto3`` and S3_* settings."""

    def __init__(self, settings: Settings) -> None:
        try:
            import boto3  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("S3 storage requires boto3: pip install boto3") from exc
        self.prefix = settings.s3_prefix.strip("/") + "/" if settings.s3_prefix else ""
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )

    def _key(self, key: str) -> str:
        return f"{self.prefix}{key}"

    def save(self, key: str, data: bytes) -> str:
        self.client.put_object(Bucket=self.bucket, Key=self._key(key), Body=data)
        return key

    def read(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=self._key(key))
        return response["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=self._key(key))

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=self._key(key))
            return True
        except Exception:
            return False

    def local_path(self, key: str) -> Path | None:
        return None


@lru_cache(maxsize=8)
def _local_for(root: str) -> LocalStorage:
    return LocalStorage(root)


def build_storage(settings: Settings) -> Storage:
    if settings.storage_backend.lower() == "s3":
        return S3Storage(settings)
    return _local_for(str(settings.media_root))
