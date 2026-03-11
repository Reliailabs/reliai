"""operational scalability membership constraints

Revision ID: 20260310_0030
Revises: 20260310_0029
Create Date: 2026-03-10 22:20:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260310_0030"
down_revision: str | Sequence[str] | None = "20260310_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM organization_members
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT
                        id,
                        row_number() OVER (
                            PARTITION BY organization_id, user_id
                            ORDER BY created_at ASC, id ASC
                        ) AS row_rank
                    FROM organization_members
                ) AS ranked
                WHERE ranked.row_rank > 1
            )
            """
        )
    )
    op.create_unique_constraint(
        "uq_organization_members_organization_user",
        "organization_members",
        ["organization_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_organization_members_organization_user",
        "organization_members",
        type_="unique",
    )
