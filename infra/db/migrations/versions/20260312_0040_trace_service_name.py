"""trace service name

Revision ID: 20260312_0040
Revises: 20260312_0039
Create Date: 2026-03-12 16:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260312_0040"
down_revision: str | Sequence[str] | None = "20260312_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("traces", sa.Column("service_name", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("traces", "service_name")
