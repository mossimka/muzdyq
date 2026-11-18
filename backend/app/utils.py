from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, date, datetime, time

UTC = UTC


def utcnow() -> datetime:
    """Naive UTC timestamp (portable between SQLite and PostgreSQL)."""
    return datetime.now(UTC).replace(tzinfo=None)


def ensure_utc(value: datetime) -> datetime:
    """Return a naive UTC datetime, treating naive input as UTC."""
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def iso_z(value: datetime | None) -> str | None:
    if value is None:
        return None
    value = ensure_utc(value)
    return value.replace(microsecond=0).isoformat() + "Z"


def parse_client_datetime(raw: str) -> datetime:
    """Parse an ISO-8601 client timestamp, accepting ``Z`` as UTC."""
    text = raw.strip()
    if text.endswith(("Z", "z")):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    return ensure_utc(parsed)


def parse_bound(raw: str | None, *, end: bool = False) -> datetime | None:
    """Parse ``YYYY``, ``YYYY-MM``, ``YYYY-MM-DD`` or full ISO for a range bound."""
    if raw is None or not raw.strip():
        return None
    value = raw.strip()
    try:
        if len(value) == 4 and value.isdigit():
            year = int(value)
            return datetime.combine(
                date(year, 12, 31) if end else date(year, 1, 1),
                time.max if end else time.min,
            )
        if len(value) == 7 and value[4] == "-":
            year, month = map(int, value.split("-"))
            if end:
                if month == 12:
                    return datetime(year, 12, 31, 23, 59, 59, 999999)
                return datetime(year, month + 1, 1) - time.resolution
            return datetime(year, month, 1)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError(f"Invalid date bound: {raw}") from exc

    parsed = parse_client_datetime(value)
    if len(value) <= 10 and end:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed


def round_down_to_hour(value: datetime) -> datetime:
    return ensure_utc(value).replace(minute=0, second=0, microsecond=0)


def hash_ip(ip: str | None, salt: str) -> str:
    """Salted, non-reversible IP fingerprint. Raw IPs are never persisted."""
    material = f"{salt}:{ip or 'unknown'}".encode()
    return hashlib.sha256(material).hexdigest()[:32]


def hash_device_token(token: str | None, salt: str) -> str | None:
    """Hash the anonymous device token; it is never stored in clear text."""
    if not token:
        return None
    token = token.strip()
    if not token or len(token) > 200:
        return None
    return hashlib.sha256(f"{salt}:device:{token}".encode()).hexdigest()[:32]


def new_client_uuid() -> str:
    """UUID helper usable from scripts/tests."""
    return secrets.token_hex(16)
