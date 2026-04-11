"""evaluation usage index

Revision ID: 20260411_0001
Revises: 20260410_0003
Create Date: 2026-04-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260411_0001"
down_revision: str | Sequence[str] | None = "20260410_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


INDEX_NAME = op.f("ix_evaluations_project_created_at")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("evaluations")}

    if INDEX_NAME not in indexes:
        op.create_index(
            INDEX_NAME,
            "evaluations",
            ["project_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("evaluations")}

    if INDEX_NAME in indexes:
        op.drop_index(INDEX_NAME, table_name="evaluations")
