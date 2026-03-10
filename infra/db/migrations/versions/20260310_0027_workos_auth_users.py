"""workos auth users

Revision ID: 20260310_0027
Revises: 20260310_0026
Create Date: 2026-03-10 23:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0027"
down_revision: str | Sequence[str] | None = "20260310_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("legacy_operator_user_id", sa.Uuid(), nullable=True),
        sa.Column("workos_user_id", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_system_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(
            ["legacy_operator_user_id"],
            ["operator_users.id"],
            name=op.f("fk_users_legacy_operator_user_id_operator_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("legacy_operator_user_id", name=op.f("uq_users_legacy_operator_user_id")),
        sa.UniqueConstraint("workos_user_id", name=op.f("uq_users_workos_user_id")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_index(op.f("ix_users_legacy_operator_user_id"), "users", ["legacy_operator_user_id"], unique=False)
    op.create_index(op.f("ix_users_workos_user_id"), "users", ["workos_user_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO users (
                id,
                legacy_operator_user_id,
                email,
                is_active,
                is_system_admin,
                created_at,
                updated_at
            )
            SELECT
                id,
                id,
                email,
                is_active,
                FALSE,
                created_at,
                updated_at
            FROM operator_users
            """
        )
    )

    op.add_column("organization_members", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE organization_members AS membership
            SET user_id = users.id
            FROM users
            WHERE membership.auth_user_id = CAST(users.id AS TEXT)
            """
        )
    )
    op.alter_column("organization_members", "auth_user_id", existing_type=sa.String(length=255), nullable=True)
    op.alter_column("organization_members", "user_id", existing_type=sa.Uuid(), nullable=False)
    op.create_foreign_key(
        op.f("fk_organization_members_user_id_users"),
        "organization_members",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_index(op.f("ix_organization_members_user_id"), "organization_members", ["user_id"], unique=False)

    op.drop_constraint(
        op.f("fk_incidents_acknowledged_by_operator_user_id_operator_users"),
        "incidents",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_incidents_owner_operator_user_id_operator_users"),
        "incidents",
        type_="foreignkey",
    )
    op.create_foreign_key(
        op.f("fk_incidents_acknowledged_by_operator_user_id_users"),
        "incidents",
        "users",
        ["acknowledged_by_operator_user_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_incidents_owner_operator_user_id_users"),
        "incidents",
        "users",
        ["owner_operator_user_id"],
        ["id"],
    )

    op.drop_constraint(
        op.f("fk_incident_events_actor_operator_user_id_operator_users"),
        "incident_events",
        type_="foreignkey",
    )
    op.create_foreign_key(
        op.f("fk_incident_events_actor_operator_user_id_users"),
        "incident_events",
        "users",
        ["actor_operator_user_id"],
        ["id"],
    )

    op.alter_column("users", "is_active", server_default=None)
    op.alter_column("users", "is_system_admin", server_default=None)
    op.alter_column("users", "created_at", server_default=None)
    op.alter_column("users", "updated_at", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_incident_events_actor_operator_user_id_users"),
        "incident_events",
        type_="foreignkey",
    )
    op.create_foreign_key(
        op.f("fk_incident_events_actor_operator_user_id_operator_users"),
        "incident_events",
        "operator_users",
        ["actor_operator_user_id"],
        ["id"],
    )

    op.drop_constraint(
        op.f("fk_incidents_owner_operator_user_id_users"),
        "incidents",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_incidents_acknowledged_by_operator_user_id_users"),
        "incidents",
        type_="foreignkey",
    )
    op.create_foreign_key(
        op.f("fk_incidents_acknowledged_by_operator_user_id_operator_users"),
        "incidents",
        "operator_users",
        ["acknowledged_by_operator_user_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_incidents_owner_operator_user_id_operator_users"),
        "incidents",
        "operator_users",
        ["owner_operator_user_id"],
        ["id"],
    )

    op.drop_index(op.f("ix_organization_members_user_id"), table_name="organization_members")
    op.drop_constraint(op.f("fk_organization_members_user_id_users"), "organization_members", type_="foreignkey")
    op.alter_column("organization_members", "auth_user_id", existing_type=sa.String(length=255), nullable=False)
    op.drop_column("organization_members", "user_id")

    op.drop_index(op.f("ix_users_workos_user_id"), table_name="users")
    op.drop_index(op.f("ix_users_legacy_operator_user_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
