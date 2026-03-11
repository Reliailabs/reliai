"""user active organization

Revision ID: 20260311_0036
Revises: 20260311_0035
Create Date: 2026-03-10 23:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260311_0036"
down_revision: str | Sequence[str] | None = "20260311_0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    foreign_keys = {foreign_key["name"] for foreign_key in inspector.get_foreign_keys("users")}

    if "active_organization_id" not in columns:
        op.add_column("users", sa.Column("active_organization_id", sa.Uuid(), nullable=True))

    if op.f("ix_users_active_organization_id") not in indexes:
        op.create_index(op.f("ix_users_active_organization_id"), "users", ["active_organization_id"], unique=False)

    if op.f("fk_users_active_organization_id_organizations") not in foreign_keys:
        op.create_foreign_key(
            op.f("fk_users_active_organization_id_organizations"),
            "users",
            "organizations",
            ["active_organization_id"],
            ["id"],
        )

    op.execute(
        sa.text(
            """
            UPDATE users AS target
            SET active_organization_id = memberships.organization_id
            FROM (
                SELECT DISTINCT ON (user_id)
                    user_id,
                    organization_id
                FROM organization_members
                WHERE user_id IS NOT NULL
                ORDER BY user_id, created_at ASC
            ) AS memberships
            WHERE target.id = memberships.user_id
              AND target.active_organization_id IS NULL
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    foreign_keys = {foreign_key["name"] for foreign_key in inspector.get_foreign_keys("users")}

    if op.f("fk_users_active_organization_id_organizations") in foreign_keys:
        op.drop_constraint(op.f("fk_users_active_organization_id_organizations"), "users", type_="foreignkey")

    if op.f("ix_users_active_organization_id") in indexes:
        op.drop_index(op.f("ix_users_active_organization_id"), table_name="users")

    if "active_organization_id" in columns:
        op.drop_column("users", "active_organization_id")
