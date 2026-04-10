"""project slos

Revision ID: 20260410_0001
Revises: 20260325_0001
Create Date: 2026-04-10 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260410_0001"
down_revision: str | Sequence[str] | None = "20260325_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_slos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metric_type", sa.String(length=64), nullable=False),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("window_days", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_slos_project_id"),
        "project_slos",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_slos_org_id",
        "project_slos",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_slos_org_id", table_name="project_slos")
    op.drop_index(op.f("ix_project_slos_project_id"), table_name="project_slos")
    op.drop_table("project_slos")
