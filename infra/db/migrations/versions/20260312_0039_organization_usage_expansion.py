"""organization usage expansion

Revision ID: 20260312_0039
Revises: 20260311_0038
Create Date: 2026-03-12 12:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260312_0039"
down_revision: str | Sequence[str] | None = "20260311_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_usage_expansion",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_30_day_traces", sa.Integer(), nullable=False),
        sa.Column("current_30_day_traces", sa.Integer(), nullable=False),
        sa.Column("expansion_ratio", sa.Float(), nullable=False),
        sa.Column("breakout_account", sa.Boolean(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_organization_usage_expansion_organization_id_organizations")),
        sa.PrimaryKeyConstraint("organization_id", name=op.f("pk_organization_usage_expansion")),
    )
    op.create_index(
        "ix_organization_usage_expansion_breakout_account",
        "organization_usage_expansion",
        ["breakout_account", "computed_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_organization_usage_expansion_breakout_account", table_name="organization_usage_expansion")
    op.drop_table("organization_usage_expansion")
