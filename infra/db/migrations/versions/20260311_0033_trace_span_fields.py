"""add span and guardrail fields to traces

Revision ID: 20260311_0033
Revises: 20260311_0032
Create Date: 2026-03-11 12:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260311_0033"
down_revision: str | Sequence[str] | None = "20260311_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("traces", sa.Column("trace_id", sa.String(length=255), nullable=True))
    op.add_column("traces", sa.Column("span_id", sa.String(length=255), nullable=True))
    op.add_column("traces", sa.Column("parent_span_id", sa.String(length=255), nullable=True))
    op.add_column("traces", sa.Column("span_name", sa.String(length=120), nullable=True))
    op.add_column("traces", sa.Column("guardrail_policy", sa.String(length=120), nullable=True))
    op.add_column("traces", sa.Column("guardrail_action", sa.String(length=120), nullable=True))

    op.execute("UPDATE traces SET trace_id = id::text WHERE trace_id IS NULL")
    op.execute("UPDATE traces SET span_id = id::text WHERE span_id IS NULL")

    op.alter_column("traces", "trace_id", nullable=False)
    op.alter_column("traces", "span_id", nullable=False)

    op.create_index("ix_traces_trace_id", "traces", ["trace_id"])
    op.create_index("ix_traces_span_id", "traces", ["span_id"])
    op.create_index("ix_traces_parent_span_id", "traces", ["parent_span_id"])


def downgrade() -> None:
    op.drop_index("ix_traces_parent_span_id", table_name="traces")
    op.drop_index("ix_traces_span_id", table_name="traces")
    op.drop_index("ix_traces_trace_id", table_name="traces")
    op.drop_column("traces", "guardrail_action")
    op.drop_column("traces", "guardrail_policy")
    op.drop_column("traces", "span_name")
    op.drop_column("traces", "parent_span_id")
    op.drop_column("traces", "span_id")
    op.drop_column("traces", "trace_id")
