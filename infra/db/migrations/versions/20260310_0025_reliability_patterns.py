"""reliability patterns

Revision ID: 20260310_0025
Revises: 20260310_0024
Create Date: 2026-03-10 20:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260310_0025"
down_revision: str | Sequence[str] | None = "20260310_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reliability_patterns",
        sa.Column("pattern_type", sa.String(length=64), nullable=False),
        sa.Column("model_family", sa.String(length=255), nullable=True),
        sa.Column("prompt_pattern_hash", sa.String(length=64), nullable=True),
        sa.Column("failure_type", sa.String(length=64), nullable=False),
        sa.Column("failure_probability", sa.Float(), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_patterns")),
    )
    op.create_index(
        "ix_reliability_patterns_type_model_prompt_failure",
        "reliability_patterns",
        ["pattern_type", "model_family", "prompt_pattern_hash", "failure_type"],
        unique=True,
    )
    op.create_index(
        "ix_reliability_patterns_probability_last_seen",
        "reliability_patterns",
        ["failure_probability", "last_seen_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reliability_patterns_probability_last_seen", table_name="reliability_patterns")
    op.drop_index("ix_reliability_patterns_type_model_prompt_failure", table_name="reliability_patterns")
    op.drop_table("reliability_patterns")
