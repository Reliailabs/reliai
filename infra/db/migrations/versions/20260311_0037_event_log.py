"""event log

Revision ID: 20260311_0037
Revises: 20260311_0036
Create Date: 2026-03-11 00:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260311_0037"
down_revision: str | Sequence[str] | None = "20260311_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "event_log",
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trace_id", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("event_id", name=op.f("pk_event_log")),
    )
    op.create_index("ix_event_log_project_timestamp", "event_log", ["project_id", "timestamp"], unique=False)
    op.create_index("ix_event_log_type_timestamp", "event_log", ["event_type", "timestamp"], unique=False)
    op.create_index("ix_event_log_trace_timestamp", "event_log", ["trace_id", "timestamp"], unique=False)
    op.create_index(op.f("ix_event_log_organization_id"), "event_log", ["organization_id"], unique=False)
    op.create_index(op.f("ix_event_log_project_id"), "event_log", ["project_id"], unique=False)
    op.create_index(op.f("ix_event_log_trace_id"), "event_log", ["trace_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_log_trace_id"), table_name="event_log")
    op.drop_index(op.f("ix_event_log_project_id"), table_name="event_log")
    op.drop_index(op.f("ix_event_log_organization_id"), table_name="event_log")
    op.drop_index("ix_event_log_trace_timestamp", table_name="event_log")
    op.drop_index("ix_event_log_type_timestamp", table_name="event_log")
    op.drop_index("ix_event_log_project_timestamp", table_name="event_log")
    op.drop_table("event_log")
