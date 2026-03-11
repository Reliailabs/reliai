"""user active organization

Revision ID: 20260310_0031
Revises: 20260310_0030
Create Date: 2026-03-10 23:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0031"
down_revision: str | Sequence[str] | None = "20260310_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("active_organization_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_users_active_organization_id"), "users", ["active_organization_id"], unique=False)
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
    op.drop_constraint(op.f("fk_users_active_organization_id_organizations"), "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_active_organization_id"), table_name="users")
    op.drop_column("users", "active_organization_id")
