"""guardrail runtime tables

Revision ID: 20260310_0013
Revises: 20260309_0012
Create Date: 2026-03-10 00:20:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260310_0013"
down_revision: str | None = "20260309_0012"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "guardrail_policies",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("policy_type", sa.String(length=64), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_guardrail_policies_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_guardrail_policies")),
    )
    op.create_index(op.f("ix_guardrail_policies_project_id"), "guardrail_policies", ["project_id"], unique=False)
    op.create_index("ix_guardrail_policies_project_active", "guardrail_policies", ["project_id", "is_active"], unique=False)

    op.create_table(
        "guardrail_events",
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("action_taken", sa.String(length=32), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["policy_id"], ["guardrail_policies.id"], name=op.f("fk_guardrail_events_policy_id_guardrail_policies")),
        sa.ForeignKeyConstraint(["trace_id"], ["traces.id"], name=op.f("fk_guardrail_events_trace_id_traces")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_guardrail_events")),
    )
    op.create_index("ix_guardrail_events_trace_id", "guardrail_events", ["trace_id"], unique=False)
    op.create_index("ix_guardrail_events_policy_id", "guardrail_events", ["policy_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_guardrail_events_policy_id", table_name="guardrail_events")
    op.drop_index("ix_guardrail_events_trace_id", table_name="guardrail_events")
    op.drop_table("guardrail_events")
    op.drop_index("ix_guardrail_policies_project_active", table_name="guardrail_policies")
    op.drop_index(op.f("ix_guardrail_policies_project_id"), table_name="guardrail_policies")
    op.drop_table("guardrail_policies")
