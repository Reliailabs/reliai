"""model identity extension

Revision ID: 20260309_0009
Revises: 20260309_0008
Create Date: 2026-03-09 22:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260309_0009"
down_revision: str | None = "20260309_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("model_versions", sa.Column("model_family", sa.String(length=120), nullable=True))
    op.add_column("model_versions", sa.Column("model_revision", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("model_versions", "model_revision")
    op.drop_column("model_versions", "model_family")
