"""trace ingestion control plane

Revision ID: 20260310_0024
Revises: 20260310_0023
Create Date: 2026-03-10 18:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0024"
down_revision: str | Sequence[str] | None = "20260310_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trace_ingestion_policies",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=True),
        sa.Column("sampling_success_rate", sa.Float(), nullable=False),
        sa.Column("sampling_error_rate", sa.Float(), nullable=False),
        sa.Column("max_metadata_fields", sa.Integer(), nullable=False),
        sa.Column("max_cardinality_per_field", sa.Integer(), nullable=False),
        sa.Column("retention_days_success", sa.Integer(), nullable=False),
        sa.Column("retention_days_error", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["environment_id"],
            ["environments.id"],
            name=op.f("fk_trace_ingestion_policies_environment_id_environments"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_trace_ingestion_policies_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trace_ingestion_policies")),
        sa.UniqueConstraint(
            "project_id",
            "environment_id",
            name="uq_trace_ingestion_policies_scope",
        ),
    )
    op.create_index(
        op.f("ix_trace_ingestion_policies_project_id"),
        "trace_ingestion_policies",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_trace_ingestion_policies_environment_id"),
        "trace_ingestion_policies",
        ["environment_id"],
        unique=False,
    )

    op.create_table(
        "metadata_cardinality",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=False),
        sa.Column("unique_values_count", sa.Integer(), nullable=False),
        sa.Column("observed_value_hashes_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["environment_id"],
            ["environments.id"],
            name=op.f("fk_metadata_cardinality_environment_id_environments"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_metadata_cardinality_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_metadata_cardinality")),
        sa.UniqueConstraint(
            "project_id",
            "environment_id",
            "field_name",
            name="uq_metadata_cardinality_scope",
        ),
    )
    op.create_index(
        op.f("ix_metadata_cardinality_project_id"),
        "metadata_cardinality",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_metadata_cardinality_environment_id"),
        "metadata_cardinality",
        ["environment_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_metadata_cardinality_environment_id"), table_name="metadata_cardinality")
    op.drop_index(op.f("ix_metadata_cardinality_project_id"), table_name="metadata_cardinality")
    op.drop_table("metadata_cardinality")

    op.drop_index(op.f("ix_trace_ingestion_policies_environment_id"), table_name="trace_ingestion_policies")
    op.drop_index(op.f("ix_trace_ingestion_policies_project_id"), table_name="trace_ingestion_policies")
    op.drop_table("trace_ingestion_policies")
