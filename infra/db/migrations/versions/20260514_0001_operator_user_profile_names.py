"""add operator user profile name fields

Revision ID: 20260514_0001
Revises: 20260513_0002
Create Date: 2026-05-14 13:05:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260514_0001"
down_revision: str | Sequence[str] | None = "20260513_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("operator_users", "first_name"):
        op.add_column("operator_users", sa.Column("first_name", sa.String(length=120), nullable=True))

    if not _has_column("operator_users", "last_name"):
        op.add_column("operator_users", sa.Column("last_name", sa.String(length=120), nullable=True))


def downgrade() -> None:
    if _has_column("operator_users", "last_name"):
        op.drop_column("operator_users", "last_name")

    if _has_column("operator_users", "first_name"):
        op.drop_column("operator_users", "first_name")
