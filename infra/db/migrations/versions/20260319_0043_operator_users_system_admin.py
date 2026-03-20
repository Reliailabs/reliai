"""operator users system admin

Revision ID: 20260319_0043
Revises: 20260319_0042
Create Date: 2026-03-19 10:38:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260319_0043"
down_revision: str | Sequence[str] | None = "20260319_0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "operator_users",
        sa.Column("is_system_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        sa.text(
            """
            UPDATE operator_users
            SET is_system_admin = users.is_system_admin
            FROM users
            WHERE users.legacy_operator_user_id = operator_users.id
            """
        )
    )
    op.alter_column("operator_users", "is_system_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("operator_users", "is_system_admin")
