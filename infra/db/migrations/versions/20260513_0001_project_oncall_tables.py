"""project on-call tables

Revision ID: 20260513_0001
Revises: 20260512_0001
Create Date: 2026-05-13 16:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260513_0001"
down_revision: str | Sequence[str] | None = "20260512_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "oncall_rotations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_oncall_rotations_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_oncall_rotations_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_oncall_rotations")),
        sa.UniqueConstraint("project_id", "name", name="uq_oncall_rotations_project_name"),
    )
    op.create_index(op.f("ix_oncall_rotations_organization_id"), "oncall_rotations", ["organization_id"], unique=False)
    op.create_index(op.f("ix_oncall_rotations_project_id"), "oncall_rotations", ["project_id"], unique=False)

    op.create_table(
        "oncall_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rotation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["rotation_id"],
            ["oncall_rotations.id"],
            name=op.f("fk_oncall_assignments_rotation_id_oncall_rotations"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_oncall_assignments_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_oncall_assignments")),
        sa.UniqueConstraint("rotation_id", "role", name="uq_oncall_assignments_rotation_role"),
    )
    op.create_index(op.f("ix_oncall_assignments_rotation_id"), "oncall_assignments", ["rotation_id"], unique=False)
    op.create_index(op.f("ix_oncall_assignments_user_id"), "oncall_assignments", ["user_id"], unique=False)

    op.create_table(
        "oncall_escalation_policies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rotation_id", sa.Uuid(), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("target_role", sa.String(length=32), nullable=False),
        sa.Column("wait_minutes", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["rotation_id"],
            ["oncall_rotations.id"],
            name=op.f("fk_oncall_escalation_policies_rotation_id_oncall_rotations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_oncall_escalation_policies")),
        sa.UniqueConstraint("rotation_id", "step_order", name="uq_oncall_escalation_rotation_step"),
    )
    op.create_index(
        op.f("ix_oncall_escalation_policies_rotation_id"),
        "oncall_escalation_policies",
        ["rotation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_oncall_escalation_policies_rotation_id"), table_name="oncall_escalation_policies")
    op.drop_table("oncall_escalation_policies")
    op.drop_index(op.f("ix_oncall_assignments_user_id"), table_name="oncall_assignments")
    op.drop_index(op.f("ix_oncall_assignments_rotation_id"), table_name="oncall_assignments")
    op.drop_table("oncall_assignments")
    op.drop_index(op.f("ix_oncall_rotations_project_id"), table_name="oncall_rotations")
    op.drop_index(op.f("ix_oncall_rotations_organization_id"), table_name="oncall_rotations")
    op.drop_table("oncall_rotations")
