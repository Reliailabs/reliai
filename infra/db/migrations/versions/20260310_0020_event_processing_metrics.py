"""event processing metrics

Revision ID: 20260310_0020
Revises: 20260310_0019
Create Date: 2026-03-10 22:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260310_0020"
down_revision: str | None = "20260310_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "event_processing_metrics",
        sa.Column("consumer_name", sa.String(length=64), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("events_processed", sa.Integer(), nullable=False),
        sa.Column("processing_latency_ms", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_event_processing_metrics_consumer_created_at",
        "event_processing_metrics",
        ["consumer_name", "created_at"],
    )
    op.create_index(
        "ix_event_processing_metrics_topic_created_at",
        "event_processing_metrics",
        ["topic", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_event_processing_metrics_topic_created_at",
        table_name="event_processing_metrics",
    )
    op.drop_index(
        "ix_event_processing_metrics_consumer_created_at",
        table_name="event_processing_metrics",
    )
    op.drop_table("event_processing_metrics")
