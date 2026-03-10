"""automation rules

Revision ID: 20260310_0022a
Revises: 20260310_0022
Create Date: 2026-03-10 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0022a"
down_revision: str | Sequence[str] | None = "20260310_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "automation_rules",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("condition_json", sa.JSON(), nullable=False),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("action_config", sa.JSON(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_automation_rules_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_automation_rules")),
    )
    op.create_index(
        op.f("ix_automation_rules_project_event_enabled"),
        "automation_rules",
        ["project_id", "event_type", "enabled"],
        unique=False,
    )
    op.create_index(op.f("ix_automation_rules_project_id"), "automation_rules", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_automation_rules_project_id"), table_name="automation_rules")
    op.drop_index(op.f("ix_automation_rules_project_event_enabled"), table_name="automation_rules")
    op.drop_table("automation_rules")
