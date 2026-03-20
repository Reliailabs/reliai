"""stripe fields on organizations

Revision ID: 20260320_0001
Revises: 20260319_0044
Create Date: 2026-03-20 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260320_0001"
down_revision: str | Sequence[str] | None = "20260319_0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("stripe_customer_id", sa.String(length=128), nullable=True))
    op.add_column("organizations", sa.Column("stripe_subscription_id", sa.String(length=128), nullable=True))
    op.add_column("organizations", sa.Column("monthly_traces", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("organizations", sa.Column("monthly_traces_reported", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("organizations", sa.Column("monthly_usage_month", sa.String(length=7), nullable=True))
    op.alter_column("organizations", "monthly_traces", server_default=None)
    op.alter_column("organizations", "monthly_traces_reported", server_default=None)


def downgrade() -> None:
    op.drop_column("organizations", "monthly_usage_month")
    op.drop_column("organizations", "monthly_traces_reported")
    op.drop_column("organizations", "monthly_traces")
    op.drop_column("organizations", "stripe_subscription_id")
    op.drop_column("organizations", "stripe_customer_id")
