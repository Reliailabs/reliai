"""add rule_source to automation rules

Revision ID: 20260311_0032
Revises: 20260310_0031
Create Date: 2026-03-11 00:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260311_0032"
down_revision: str | Sequence[str] | None = "20260310_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "automation_rules",
        sa.Column("rule_source", sa.String(length=32), nullable=False, server_default="manual"),
    )
    op.alter_column("automation_rules", "rule_source", server_default=None)


def downgrade() -> None:
    op.drop_column("automation_rules", "rule_source")
