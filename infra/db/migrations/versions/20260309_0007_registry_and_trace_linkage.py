"""prompt and model registry linkage

Revision ID: 20260309_0007
Revises: 20260309_0006
Create Date: 2026-03-09 16:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260309_0007"
down_revision: str | None = "20260309_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "prompt_versions",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.String(length=120), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_prompt_versions_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prompt_versions")),
        sa.UniqueConstraint("project_id", "version", name="uq_prompt_versions_project_version"),
    )
    op.create_index(op.f("ix_prompt_versions_project_id"), "prompt_versions", ["project_id"], unique=False)

    op.create_table(
        "model_versions",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("identity_key", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=120), nullable=True),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("model_version", sa.String(length=120), nullable=True),
        sa.Column("route_key", sa.String(length=120), nullable=True),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_model_versions_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_model_versions")),
        sa.UniqueConstraint("project_id", "identity_key", name="uq_model_versions_project_identity_key"),
    )
    op.create_index(op.f("ix_model_versions_project_id"), "model_versions", ["project_id"], unique=False)

    op.add_column("traces", sa.Column("prompt_version_record_id", sa.Uuid(), nullable=True))
    op.add_column("traces", sa.Column("model_version_record_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_traces_prompt_version_record_id"), "traces", ["prompt_version_record_id"], unique=False)
    op.create_index(op.f("ix_traces_model_version_record_id"), "traces", ["model_version_record_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_traces_prompt_version_record_id_prompt_versions"),
        "traces",
        "prompt_versions",
        ["prompt_version_record_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_traces_model_version_record_id_model_versions"),
        "traces",
        "model_versions",
        ["model_version_record_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_traces_model_version_record_id_model_versions"), "traces", type_="foreignkey")
    op.drop_constraint(op.f("fk_traces_prompt_version_record_id_prompt_versions"), "traces", type_="foreignkey")
    op.drop_index(op.f("ix_traces_model_version_record_id"), table_name="traces")
    op.drop_index(op.f("ix_traces_prompt_version_record_id"), table_name="traces")
    op.drop_column("traces", "model_version_record_id")
    op.drop_column("traces", "prompt_version_record_id")
    op.drop_index(op.f("ix_model_versions_project_id"), table_name="model_versions")
    op.drop_table("model_versions")
    op.drop_index(op.f("ix_prompt_versions_project_id"), table_name="prompt_versions")
    op.drop_table("prompt_versions")
