"""global model reliability aggregates

Revision ID: 20260310_0014
Revises: 20260310_0013
Create Date: 2026-03-10 01:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260310_0014"
down_revision: str | None = "20260310_0013"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "global_model_reliability",
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("metric_name", sa.String(length=128), nullable=False),
        sa.Column("metric_value", sa.Float(), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("provider", "model_name", "metric_name", name="pk_global_model_reliability"),
    )


def downgrade() -> None:
    op.drop_table("global_model_reliability")
