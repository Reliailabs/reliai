"""admin events

Revision ID: 20260319_0041
Revises: 20260312_0040
Create Date: 2026-03-19 10:02:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260319_0041"
down_revision: str | Sequence[str] | None = "20260312_0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_events",
        sa.Column("id", sa.Uuid, primary_key=True, nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.String(length=32), nullable=False),
        sa.Column("target_email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("admin_events")
