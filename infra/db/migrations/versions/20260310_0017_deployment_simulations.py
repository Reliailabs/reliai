"""deployment simulations

Revision ID: 20260310_0017
Revises: 20260310_0016
Create Date: 2026-03-10 18:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260310_0017"
down_revision: str | None = "20260310_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deployment_simulations",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trace_sample_size", sa.Integer(), nullable=False),
        sa.Column("predicted_failure_rate", sa.Numeric(6, 4), nullable=True),
        sa.Column("predicted_latency_ms", sa.Numeric(12, 2), nullable=True),
        sa.Column("risk_level", sa.String(length=16), nullable=True),
        sa.Column("analysis_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["model_version_id"], ["model_versions.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["prompt_version_id"], ["prompt_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')",
            name="ck_deployment_simulations_risk_level",
        ),
    )
    op.create_index(
        "ix_deployment_simulations_project_created_at",
        "deployment_simulations",
        ["project_id", "created_at"],
    )
    op.create_index(
        "ix_deployment_simulations_risk_level_created_at",
        "deployment_simulations",
        ["risk_level", "created_at"],
    )
    op.create_index(
        "ix_deployment_simulations_prompt_version_id",
        "deployment_simulations",
        ["prompt_version_id"],
    )
    op.create_index(
        "ix_deployment_simulations_model_version_id",
        "deployment_simulations",
        ["model_version_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_deployment_simulations_model_version_id", table_name="deployment_simulations")
    op.drop_index("ix_deployment_simulations_prompt_version_id", table_name="deployment_simulations")
    op.drop_index("ix_deployment_simulations_risk_level_created_at", table_name="deployment_simulations")
    op.drop_index("ix_deployment_simulations_project_created_at", table_name="deployment_simulations")
    op.drop_table("deployment_simulations")
