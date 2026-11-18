"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "point",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("name_i18n", sa.JSON(), nullable=False),
        sa.Column("description_i18n", sa.JSON(), nullable=False),
        sa.Column("safety_note_i18n", sa.JSON(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("elevation_m", sa.Integer(), nullable=True),
        sa.Column("coords_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("type IN ('glacier', 'water')", name="ck_point_type"),
        sa.UniqueConstraint("slug", name="uq_point_slug"),
    )
    op.create_index("ix_point_slug", "point", ["slug"], unique=True)
    op.create_index("ix_point_type", "point", ["type"], unique=False)

    op.create_table(
        "viewpoint",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("point_id", sa.Integer(), nullable=False),
        sa.Column("reference_photo", sa.String(length=255), nullable=True),
        sa.Column("heading_deg", sa.Integer(), nullable=True),
        sa.Column("note_i18n", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["point_id"], ["point.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_viewpoint_point_id", "viewpoint", ["point_id"], unique=False)

    op.create_table(
        "photo",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("point_id", sa.Integer(), nullable=False),
        sa.Column("viewpoint_id", sa.String(length=64), nullable=True),
        sa.Column("client_uuid", sa.String(length=64), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("license", sa.String(length=32), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("phash", sa.String(length=16), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("file_path", sa.String(length=255), nullable=False),
        sa.Column("thumb_path", sa.String(length=255), nullable=False),
        sa.Column("rejection_reason", sa.String(length=255), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("device_hash", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'published', 'hidden', 'rejected')",
            name="ck_photo_status",
        ),
        sa.ForeignKeyConstraint(["point_id"], ["point.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["viewpoint_id"], ["viewpoint.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("client_uuid", name="uq_photo_client_uuid"),
    )
    op.create_index("ix_photo_point_id", "photo", ["point_id"], unique=False)
    op.create_index("ix_photo_viewpoint_id", "photo", ["viewpoint_id"], unique=False)
    op.create_index("ix_photo_taken_at", "photo", ["taken_at"], unique=False)
    op.create_index("ix_photo_status", "photo", ["status"], unique=False)
    op.create_index("ix_photo_point_taken", "photo", ["point_id", "taken_at"], unique=False)
    op.create_index("ix_photo_point_status", "photo", ["point_id", "status"], unique=False)

    if is_postgres:
        # PostGIS is available for researchers; the API itself stays portable.
        # Coordinates are still stored as lat/lon so SQLite remains supported.
        op.execute(
            """
            CREATE OR REPLACE VIEW point_geo AS
            SELECT
                id,
                slug,
                type,
                lat,
                lon,
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography AS geom
            FROM point
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP VIEW IF EXISTS point_geo")
    op.drop_index("ix_photo_point_status", table_name="photo")
    op.drop_index("ix_photo_point_taken", table_name="photo")
    op.drop_index("ix_photo_status", table_name="photo")
    op.drop_index("ix_photo_taken_at", table_name="photo")
    op.drop_index("ix_photo_viewpoint_id", table_name="photo")
    op.drop_index("ix_photo_point_id", table_name="photo")
    op.drop_table("photo")
    op.drop_index("ix_viewpoint_point_id", table_name="viewpoint")
    op.drop_table("viewpoint")
    op.drop_index("ix_point_type", table_name="point")
    op.drop_index("ix_point_slug", table_name="point")
    op.drop_table("point")
