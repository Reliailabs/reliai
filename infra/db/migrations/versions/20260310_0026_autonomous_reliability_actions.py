"""autonomous reliability actions

Revision ID: 20260310_0026
Revises: 20260310_0025
Create Date: 2026-03-10 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0026"
down_revision: str | Sequence[str] | None = "20260310_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("automation_rules", sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="60"))
    op.add_column("automation_rules", sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column(
        "automation_rules",
        sa.Column("max_actions_per_hour", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("automation_rules", "cooldown_minutes", server_default=None)
    op.alter_column("automation_rules", "dry_run", server_default=None)
    op.alter_column("automation_rules", "max_actions_per_hour", server_default=None)

    op.create_table(
        "reliability_action_logs",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Uuid(), nullable=True),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("target", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("detail_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_reliability_action_logs_project_id_projects")),
        sa.ForeignKeyConstraint(["rule_id"], ["automation_rules.id"], name=op.f("fk_reliability_action_logs_rule_id_automation_rules")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_action_logs")),
    )
    op.create_index(op.f("ix_reliability_action_logs_project_id"), "reliability_action_logs", ["project_id"], unique=False)
    op.create_index(op.f("ix_reliability_action_logs_rule_id"), "reliability_action_logs", ["rule_id"], unique=False)
    op.create_index(
        "ix_reliability_action_logs_project_created_at",
        "reliability_action_logs",
        ["project_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reliability_action_logs_rule_created_at",
        "reliability_action_logs",
        ["rule_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reliability_action_logs_rule_created_at", table_name="reliability_action_logs")
    op.drop_index("ix_reliability_action_logs_project_created_at", table_name="reliability_action_logs")
    op.drop_index(op.f("ix_reliability_action_logs_rule_id"), table_name="reliability_action_logs")
    op.drop_index(op.f("ix_reliability_action_logs_project_id"), table_name="reliability_action_logs")
    op.drop_table("reliability_action_logs")

    op.drop_column("automation_rules", "max_actions_per_hour")
    op.drop_column("automation_rules", "dry_run")
    op.drop_column("automation_rules", "cooldown_minutes")
