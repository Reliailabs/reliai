"""external processors

Revision ID: 20260310_0022
Revises: 20260310_0021
Create Date: 2026-03-10 23:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260310_0022"
down_revision: str | None = "20260310_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "external_processors",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("endpoint_url", sa.Text(), nullable=False),
        sa.Column("secret", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_external_processors_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_external_processors")),
    )
    op.create_index(
        "ix_external_processors_project_event_enabled",
        "external_processors",
        ["project_id", "event_type", "enabled"],
        unique=False,
    )
    op.create_index(op.f("ix_external_processors_project_id"), "external_processors", ["project_id"], unique=False)

    op.create_table(
        "processor_failures",
        sa.Column("external_processor_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["external_processor_id"],
            ["external_processors.id"],
            name=op.f("fk_processor_failures_external_processor_id_external_processors"),
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_processor_failures_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_processor_failures")),
    )
    op.create_index(
        "ix_processor_failures_processor_created_at",
        "processor_failures",
        ["external_processor_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_processor_failures_project_created_at",
        "processor_failures",
        ["project_id", "created_at"],
        unique=False,
    )
    op.create_index(op.f("ix_processor_failures_external_processor_id"), "processor_failures", ["external_processor_id"], unique=False)
    op.create_index(op.f("ix_processor_failures_project_id"), "processor_failures", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_processor_failures_project_id"), table_name="processor_failures")
    op.drop_index(op.f("ix_processor_failures_external_processor_id"), table_name="processor_failures")
    op.drop_index("ix_processor_failures_project_created_at", table_name="processor_failures")
    op.drop_index("ix_processor_failures_processor_created_at", table_name="processor_failures")
    op.drop_table("processor_failures")
    op.drop_index(op.f("ix_external_processors_project_id"), table_name="external_processors")
    op.drop_index("ix_external_processors_project_event_enabled", table_name="external_processors")
    op.drop_table("external_processors")
