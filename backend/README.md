# Muzdyq backend

FastAPI service for anonymous citizen-science photo uploads, the fixed point
catalogue and CC BY 4.0 exports. SQLAlchemy 2, PostgreSQL/PostGIS in production,
SQLite for local development.

See the [repository README](../README.md), [API reference](../docs/API.md) and
[architecture](../docs/ARCHITECTURE.md).

## Development

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

- API: <http://127.0.0.1:8000>
- Docs: <http://127.0.0.1:8000/docs>
- Database: `backend/data/muzdyq.db` (SQLite)
- Media: `backend/data/media/`

Startup creates the schema, seeds `seed/points.json` and generates labelled
synthetic demo photos when `SEED_DEMO=true`.

## Tests

```bash
./venv/bin/ruff check app tests
./venv/bin/pytest -q
```

The suite covers EXIF stripping, face blur, upload idempotency, near-duplicate
detection, exports, rate limiting and health. Tests use a temporary database and
`SEED_DEMO=false`.

## Migrations

```bash
./venv/bin/alembic upgrade head
./venv/bin/alembic revision --autogenerate -m "describe change"
```

The initial migration creates the tables, indexes and the PostGIS `point_geo`
view. SQLite skips the view.

## Seeding

```bash
./venv/bin/python -m app.seed            # points + references + demo photos
./venv/bin/python -m app.seed --no-demo  # catalogue only
```

Seeding is idempotent: points and viewpoints are upserted by slug/id; demo
photos use deterministic UUIDs and are regenerated only when missing.

## Configuration

All settings come from environment variables or `backend/.env`; see
`app/config.py` and the root [`.env.example`](../.env.example). Important values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `sqlite:///…` or `postgresql+psycopg://…` |
| `MEDIA_ROOT` | Originals, thumbnails and references |
| `ADMIN_TOKEN` | Required for `/api/admin/*` |
| `IP_HASH_SALT` | Salt for IP/device hashes |
| `SEED_ON_STARTUP`, `SEED_DEMO` | Development seeding |
| `MAX_UPLOAD_BYTES` | Upload limit (default 15 MB) |
| `UPLOAD_LIMIT_PER_MINUTE`, `UPLOAD_LIMIT_PER_HOUR` | Rate limits |
| `STORAGE_BACKEND` | `local` (default) or `s3` |

## Layout

```
app/
├── api/          points, photos, export, admin, health, deps
├── services/     images, face blur, phash, storage, rate limiting
├── assets/       YuNet face-detection model
├── models.py     Point, Viewpoint, Photo
├── schemas.py    Pydantic models
├── seed.py       idempotent seed + synthetic scenes
├── main.py       app factory, middleware, lifespan
└── config.py     environment settings
alembic/          schema migrations
seed/points.json  reproducible monitoring points (coordinates unverified)
tests/            pytest suite
```

## Invariants

- No accounts, no contributor identity, no raw IP storage.
- Strip EXIF on the server even though the client already did it.
- Uploads are anonymous and idempotent by `client_uuid`.
- `taken_at` is rounded down to the hour.
- Only predefined viewpoints of a point accept photos.
- Exports include licence, attribution and the scientific disclaimer.
- Admin endpoints require `X-Admin-Token` and are never referenced by the PWA.
