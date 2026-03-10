"""deployment risk scores

Revision ID: 20260310_0016
Revises: 20260310_0015
Create Date: 2026-03-10 12:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260310_0016"
down_revision: str | None = "20260310_0015"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deployment_risk_scores",
        sa.Column("deployment_id", sa.UUID(), nullable=False),
        sa.Column("risk_score", sa.Numeric(6, 4), nullable=False),
        sa.Column("risk_level", sa.String(length=16), nullable=False),
        sa.Column("analysis_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["deployment_id"], ["deployments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deployment_id", name="uq_deployment_risk_scores_deployment_id"),
        sa.CheckConstraint(
            "risk_level IN ('low', 'medium', 'high')",
            name="ck_deployment_risk_scores_risk_level",
        ),
    )
    op.create_index(
        "ix_deployment_risk_scores_deployment_id",
        "deployment_risk_scores",
        ["deployment_id"],
        unique=False,
    )
    op.create_index(
        "ix_deployment_risk_scores_created_at",
        "deployment_risk_scores",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_deployment_risk_scores_risk_level_created_at",
        "deployment_risk_scores",
        ["risk_level", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_deployment_risk_scores_risk_level_created_at", table_name="deployment_risk_scores")
    op.drop_index("ix_deployment_risk_scores_created_at", table_name="deployment_risk_scores")
    op.drop_index("ix_deployment_risk_scores_deployment_id", table_name="deployment_risk_scores")
    op.drop_table("deployment_risk_scores")
