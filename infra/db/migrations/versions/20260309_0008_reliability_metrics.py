"""reliability metrics layer

Revision ID: 20260309_0008
Revises: 20260309_0007
Create Date: 2026-03-09 20:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260309_0008"
down_revision: str | None = "20260309_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reliability_metrics",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_id", sa.String(length=255), nullable=False),
        sa.Column("metric_name", sa.String(length=128), nullable=False),
        sa.Column("window_minutes", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value_number", sa.Float(), nullable=False),
        sa.Column("numerator", sa.Float(), nullable=True),
        sa.Column("denominator", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_reliability_metrics_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_reliability_metrics_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_metrics")),
    )
    op.create_index(
        "ix_reliability_metrics_org_metric_window_end",
        "reliability_metrics",
        ["organization_id", "metric_name", "window_end"],
        unique=False,
    )
    op.create_index(
        "ix_reliability_metrics_project_metric_window_end",
        "reliability_metrics",
        ["project_id", "metric_name", "window_end"],
        unique=False,
    )
    op.create_index(
        "ix_reliability_metrics_scope_metric_window_end",
        "reliability_metrics",
        ["scope_type", "scope_id", "metric_name", "window_end"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reliability_metrics_organization_id"),
        "reliability_metrics",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reliability_metrics_project_id"),
        "reliability_metrics",
        ["project_id"],
        unique=False,
    )

    op.add_column("projects", sa.Column("last_trace_received_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("traces", sa.Column("is_explainable", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("traces", "is_explainable", server_default=None)
    op.create_index(
        "ix_traces_prompt_version_record_created_at",
        "traces",
        ["prompt_version_record_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_traces_model_version_record_created_at",
        "traces",
        ["model_version_record_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_incidents_project_started_at",
        "incidents",
        ["project_id", "started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_incidents_project_started_at", table_name="incidents")
    op.drop_index("ix_traces_model_version_record_created_at", table_name="traces")
    op.drop_index("ix_traces_prompt_version_record_created_at", table_name="traces")
    op.drop_column("traces", "is_explainable")
    op.drop_column("projects", "last_trace_received_at")
    op.drop_index(op.f("ix_reliability_metrics_project_id"), table_name="reliability_metrics")
    op.drop_index(op.f("ix_reliability_metrics_organization_id"), table_name="reliability_metrics")
    op.drop_index("ix_reliability_metrics_scope_metric_window_end", table_name="reliability_metrics")
    op.drop_index("ix_reliability_metrics_project_metric_window_end", table_name="reliability_metrics")
    op.drop_index("ix_reliability_metrics_org_metric_window_end", table_name="reliability_metrics")
    op.drop_table("reliability_metrics")
