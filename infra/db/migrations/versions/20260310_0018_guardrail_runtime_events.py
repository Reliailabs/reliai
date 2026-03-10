"""guardrail runtime events

Revision ID: 20260310_0018
Revises: 20260310_0017
Create Date: 2026-03-10 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260310_0018"
down_revision: str | None = "20260310_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "guardrail_runtime_events",
        sa.Column("trace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_taken", sa.String(length=32), nullable=False),
        sa.Column("provider_model", sa.String(length=255), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["policy_id"], ["guardrail_policies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_guardrail_runtime_events_policy_created_at",
        "guardrail_runtime_events",
        ["policy_id", "created_at"],
    )
    op.create_index(
        "ix_guardrail_runtime_events_trace_id",
        "guardrail_runtime_events",
        ["trace_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_guardrail_runtime_events_trace_id", table_name="guardrail_runtime_events")
    op.drop_index("ix_guardrail_runtime_events_policy_created_at", table_name="guardrail_runtime_events")
    op.drop_table("guardrail_runtime_events")
