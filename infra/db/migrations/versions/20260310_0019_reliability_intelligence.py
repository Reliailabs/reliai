"""reliability intelligence tables

Revision ID: 20260310_0019
Revises: 20260310_0018
Create Date: 2026-03-10 22:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260310_0019"
down_revision: str | None = "20260310_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "model_reliability_patterns",
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("failure_modes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("structured_output_failure_rate", sa.Float(), nullable=False),
        sa.Column("latency_percentiles", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("cost_distribution", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("provider", "model_name", name="pk_model_reliability_patterns"),
    )
    op.create_table(
        "prompt_failure_patterns",
        sa.Column("prompt_pattern_hash", sa.String(length=64), nullable=False),
        sa.Column("failure_rate", sa.Float(), nullable=False),
        sa.Column("token_range", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model_distribution", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("prompt_pattern_hash", name="pk_prompt_failure_patterns"),
    )
    op.create_table(
        "guardrail_effectiveness",
        sa.Column("policy_type", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("failure_reduction_rate", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("policy_type", "action", name="pk_guardrail_effectiveness"),
    )


def downgrade() -> None:
    op.drop_table("guardrail_effectiveness")
    op.drop_table("prompt_failure_patterns")
    op.drop_table("model_reliability_patterns")
