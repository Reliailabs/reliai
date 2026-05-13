"""organization member display name

Revision ID: 20260513_0002
Revises: 20260513_0001
Create Date: 2026-05-13 17:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260513_0002"
down_revision: str | Sequence[str] | None = "20260513_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("organization_members", sa.Column("display_name", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("organization_members", "display_name")
