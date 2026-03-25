"""project custom metrics

Revision ID: 20260325_0001
Revises: 20260322_0001
Create Date: 2026-03-25 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260325_0001"
down_revision: str | Sequence[str] | None = "20260322_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_custom_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("metric_key", sa.String(length=120), nullable=False),
        sa.Column("metric_type", sa.String(length=32), nullable=False),
        sa.Column("value_mode", sa.String(length=32), nullable=False),
        sa.Column("pattern", sa.String(length=500), nullable=True),
        sa.Column("keywords_json", sa.JSON(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "metric_key", name="uq_project_custom_metrics_project_key"),
    )
    op.create_index(
        "ix_project_custom_metrics_project_enabled",
        "project_custom_metrics",
        ["project_id", "enabled"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_custom_metrics_project_id"),
        "project_custom_metrics",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_project_custom_metrics_project_id"), table_name="project_custom_metrics")
    op.drop_index("ix_project_custom_metrics_project_enabled", table_name="project_custom_metrics")
    op.drop_table("project_custom_metrics")
