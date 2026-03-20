"""admin events reason

Revision ID: 20260319_0042
Revises: 20260319_0041
Create Date: 2026-03-19 10:25:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260319_0042"
down_revision: str | Sequence[str] | None = "20260319_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("admin_events", sa.Column("reason", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("admin_events", "reason")
