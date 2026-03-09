"""incident and regression workflow

Revision ID: 20260309_0004
Revises: 20260309_0003
Create Date: 2026-03-09 15:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0004"
down_revision = "20260309_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evaluation_rollups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_id", sa.String(length=255), nullable=False),
        sa.Column("metric_name", sa.String(length=128), nullable=False),
        sa.Column("window_minutes", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("metric_value", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_evaluation_rollups_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name=op.f("fk_evaluation_rollups_project_id_projects")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evaluation_rollups")),
        sa.UniqueConstraint(
            "scope_type",
            "scope_id",
            "metric_name",
            "window_minutes",
            "window_start",
            "window_end",
            name="uq_evaluation_rollups_scope_metric_window",
        ),
    )
    op.create_index(
        op.f("ix_evaluation_rollups_organization_id"),
        "evaluation_rollups",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_evaluation_rollups_project_id"),
        "evaluation_rollups",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_evaluation_rollups_project_window",
        "evaluation_rollups",
        ["project_id", "window_minutes"],
        unique=False,
    )
    op.create_index(
        "ix_evaluation_rollups_organization_window",
        "evaluation_rollups",
        ["organization_id", "window_minutes"],
        unique=False,
    )

    op.create_table(
        "regression_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("metric_name", sa.String(length=128), nullable=False),
        sa.Column("current_value", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("baseline_value", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("delta_absolute", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("delta_percent", sa.Numeric(precision=14, scale=6), nullable=True),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_id", sa.String(length=255), nullable=False),
        sa.Column("window_minutes", sa.Integer(), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_regression_snapshots_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name=op.f("fk_regression_snapshots_project_id_projects")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_regression_snapshots")),
        sa.UniqueConstraint(
            "scope_type",
            "scope_id",
            "metric_name",
            "window_minutes",
            name="uq_regression_snapshots_scope_metric_window",
        ),
    )
    op.create_index(
        op.f("ix_regression_snapshots_organization_id"),
        "regression_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_regression_snapshots_project_id"),
        "regression_snapshots",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_regression_snapshots_project_detected_at",
        "regression_snapshots",
        ["project_id", "detected_at"],
        unique=False,
    )
    op.create_index(
        "ix_regression_snapshots_organization_detected_at",
        "regression_snapshots",
        ["organization_id", "detected_at"],
        unique=False,
    )

    op.create_table(
        "incidents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("incident_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("fingerprint", sa.String(length=255), nullable=False),
        sa.Column("summary_json", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], name=op.f("fk_incidents_organization_id_organizations")
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name=op.f("fk_incidents_project_id_projects")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_incidents")),
        sa.UniqueConstraint("fingerprint", name="uq_incidents_fingerprint"),
    )
    op.create_index(op.f("ix_incidents_organization_id"), "incidents", ["organization_id"], unique=False)
    op.create_index(op.f("ix_incidents_project_id"), "incidents", ["project_id"], unique=False)
    op.create_index(
        "ix_incidents_org_status_started_at",
        "incidents",
        ["organization_id", "status", "started_at"],
        unique=False,
    )
    op.create_index(
        "ix_incidents_project_status_started_at",
        "incidents",
        ["project_id", "status", "started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_incidents_project_status_started_at", table_name="incidents")
    op.drop_index("ix_incidents_org_status_started_at", table_name="incidents")
    op.drop_index(op.f("ix_incidents_project_id"), table_name="incidents")
    op.drop_index(op.f("ix_incidents_organization_id"), table_name="incidents")
    op.drop_table("incidents")

    op.drop_index(
        "ix_regression_snapshots_organization_detected_at", table_name="regression_snapshots"
    )
    op.drop_index("ix_regression_snapshots_project_detected_at", table_name="regression_snapshots")
    op.drop_index(op.f("ix_regression_snapshots_project_id"), table_name="regression_snapshots")
    op.drop_index(op.f("ix_regression_snapshots_organization_id"), table_name="regression_snapshots")
    op.drop_table("regression_snapshots")

    op.drop_index("ix_evaluation_rollups_organization_window", table_name="evaluation_rollups")
    op.drop_index("ix_evaluation_rollups_project_window", table_name="evaluation_rollups")
    op.drop_index(op.f("ix_evaluation_rollups_project_id"), table_name="evaluation_rollups")
    op.drop_index(op.f("ix_evaluation_rollups_organization_id"), table_name="evaluation_rollups")
    op.drop_table("evaluation_rollups")
