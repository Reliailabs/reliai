"""org escalation policies

Revision ID: 20260410_0002
Revises: 20260410_0001
Create Date: 2026-04-10 12:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260410_0002"
down_revision: str | Sequence[str] | None = "20260410_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "org_escalation_policies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("trigger_severity", sa.String(length=32), nullable=False),
        sa.Column("unacknowledged_after_minutes", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_org_escalation_policies_org_id",
        "org_escalation_policies",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "org_escalation_policy_steps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("delay_minutes", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("target", sa.String(length=512), nullable=False),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["org_escalation_policies.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_org_escalation_policy_steps_policy_id"),
        "org_escalation_policy_steps",
        ["policy_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_org_escalation_policy_steps_policy_id"),
        table_name="org_escalation_policy_steps",
    )
    op.drop_table("org_escalation_policy_steps")
    op.drop_index("ix_org_escalation_policies_org_id", table_name="org_escalation_policies")
    op.drop_table("org_escalation_policies")
