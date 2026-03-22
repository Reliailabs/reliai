"""organization config snapshots

Revision ID: 20260322_0001
Revises: 20260320_0001
Create Date: 2026-03-22 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260322_0001"
down_revision: str | Sequence[str] | None = "20260320_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_config_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("source_trace_id", sa.String(length=255), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_organization_config_snapshots_org_created_at",
        "organization_config_snapshots",
        ["organization_id", "created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_config_snapshots_organization_id"),
        "organization_config_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_config_snapshots_created_by"),
        "organization_config_snapshots",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_organization_config_snapshots_created_by"), table_name="organization_config_snapshots")
    op.drop_index(op.f("ix_organization_config_snapshots_organization_id"), table_name="organization_config_snapshots")
    op.drop_index("ix_organization_config_snapshots_org_created_at", table_name="organization_config_snapshots")
    op.drop_table("organization_config_snapshots")
