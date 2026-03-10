"""trace warehouse query indexes

Revision ID: 20260310_0015
Revises: 20260310_0014
Create Date: 2026-03-10 09:20:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260310_0015"
down_revision: str | None = "20260310_0014"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_traces_project_created_at_desc ON traces (project_id, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_traces_prompt_version_record_created_at_desc ON traces (prompt_version_record_id, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_traces_model_version_record_created_at_desc ON traces (model_version_record_id, created_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_traces_model_version_record_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_traces_prompt_version_record_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_traces_project_created_at_desc")
