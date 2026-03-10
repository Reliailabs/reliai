"""investigation indexes

Revision ID: 20260309_0010
Revises: 20260309_0009
Create Date: 2026-03-09 22:20:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260309_0010"
down_revision: str | None = "20260309_0009"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_traces_project_created_at", table_name="traces")
    op.drop_index("ix_traces_prompt_version_record_created_at", table_name="traces")
    op.drop_index("ix_traces_model_version_record_created_at", table_name="traces")
    op.drop_index("ix_incidents_project_started_at", table_name="incidents")
    op.drop_index("ix_regression_snapshots_project_detected_at", table_name="regression_snapshots")
    op.create_index(
        "ix_traces_project_created_at_desc",
        "traces",
        ["project_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_traces_prompt_version_record_created_at_desc",
        "traces",
        ["prompt_version_record_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_traces_model_version_record_created_at_desc",
        "traces",
        ["model_version_record_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_incidents_project_started_at_desc",
        "incidents",
        ["project_id", "started_at"],
        unique=False,
    )
    op.create_index(
        "ix_regression_snapshots_project_detected_at_desc",
        "regression_snapshots",
        ["project_id", "detected_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_regression_snapshots_project_detected_at_desc", table_name="regression_snapshots")
    op.drop_index("ix_incidents_project_started_at_desc", table_name="incidents")
    op.drop_index("ix_traces_model_version_record_created_at_desc", table_name="traces")
    op.drop_index("ix_traces_prompt_version_record_created_at_desc", table_name="traces")
    op.drop_index("ix_traces_project_created_at_desc", table_name="traces")
    op.create_index("ix_regression_snapshots_project_detected_at", "regression_snapshots", ["project_id", "detected_at"], unique=False)
    op.create_index("ix_incidents_project_started_at", "incidents", ["project_id", "started_at"], unique=False)
    op.create_index("ix_traces_model_version_record_created_at", "traces", ["model_version_record_id", "created_at"], unique=False)
    op.create_index("ix_traces_prompt_version_record_created_at", "traces", ["prompt_version_record_id", "created_at"], unique=False)
    op.create_index("ix_traces_project_created_at", "traces", ["project_id", "created_at"], unique=False)
