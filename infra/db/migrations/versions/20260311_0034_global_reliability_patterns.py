"""add global reliability patterns

Revision ID: 20260311_0034
Revises: 20260311_0033
Create Date: 2026-03-11 16:05:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260311_0034"
down_revision: str | None = "20260311_0033"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "global_reliability_patterns",
        sa.Column("pattern_id", sa.String(length=64), nullable=False),
        sa.Column("pattern_type", sa.String(length=64), nullable=False),
        sa.Column("conditions_json", sa.JSON(), nullable=False),
        sa.Column("impact_metrics_json", sa.JSON(), nullable=False),
        sa.Column("occurrence_count", sa.Integer(), nullable=False),
        sa.Column("organizations_affected", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("pattern_id", name=op.f("pk_global_reliability_patterns")),
    )
    op.create_index(
        "ix_global_reliability_patterns_confidence_occurrence",
        "global_reliability_patterns",
        ["confidence_score", "occurrence_count"],
        unique=False,
    )
    op.create_index(
        "ix_global_reliability_patterns_type_created_at",
        "global_reliability_patterns",
        ["pattern_type", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_global_reliability_patterns_type_created_at", table_name="global_reliability_patterns")
    op.drop_index("ix_global_reliability_patterns_confidence_occurrence", table_name="global_reliability_patterns")
    op.drop_table("global_reliability_patterns")
