"""deployments and deployment linkage

Revision ID: 20260309_0012
Revises: 20260309_0011
Create Date: 2026-03-09 23:55:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260309_0012"
down_revision: str | None = "20260309_0011"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deployments",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("prompt_version_id", sa.Uuid(), nullable=True),
        sa.Column("model_version_id", sa.Uuid(), nullable=True),
        sa.Column("environment", sa.String(length=32), nullable=False),
        sa.Column("deployed_by", sa.String(length=255), nullable=True),
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["model_version_id"], ["model_versions.id"], name=op.f("fk_deployments_model_version_id_model_versions")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_deployments_project_id_projects")),
        sa.ForeignKeyConstraint(["prompt_version_id"], ["prompt_versions.id"], name=op.f("fk_deployments_prompt_version_id_prompt_versions")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deployments")),
    )
    op.create_index("ix_deployments_project_deployed_at_desc", "deployments", ["project_id", "deployed_at"], unique=False)
    op.create_index(op.f("ix_deployments_project_id"), "deployments", ["project_id"], unique=False)
    op.create_index(op.f("ix_deployments_prompt_version_id"), "deployments", ["prompt_version_id"], unique=False)
    op.create_index(op.f("ix_deployments_model_version_id"), "deployments", ["model_version_id"], unique=False)

    op.create_table(
        "deployment_events",
        sa.Column("deployment_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["deployment_id"], ["deployments.id"], name=op.f("fk_deployment_events_deployment_id_deployments")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deployment_events")),
    )
    op.create_index("ix_deployment_events_deployment_id_created_at", "deployment_events", ["deployment_id", "created_at"], unique=False)
    op.create_index(op.f("ix_deployment_events_deployment_id"), "deployment_events", ["deployment_id"], unique=False)

    op.create_table(
        "deployment_rollbacks",
        sa.Column("deployment_id", sa.Uuid(), nullable=False),
        sa.Column("rollback_reason", sa.Text(), nullable=False),
        sa.Column("rolled_back_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["deployment_id"], ["deployments.id"], name=op.f("fk_deployment_rollbacks_deployment_id_deployments")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deployment_rollbacks")),
    )
    op.create_index("ix_deployment_rollbacks_deployment_id_rolled_back_at", "deployment_rollbacks", ["deployment_id", "rolled_back_at"], unique=False)
    op.create_index(op.f("ix_deployment_rollbacks_deployment_id"), "deployment_rollbacks", ["deployment_id"], unique=False)

    op.add_column("incidents", sa.Column("deployment_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_incidents_deployment_id"), "incidents", ["deployment_id"], unique=False)
    op.create_foreign_key(op.f("fk_incidents_deployment_id_deployments"), "incidents", "deployments", ["deployment_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint(op.f("fk_incidents_deployment_id_deployments"), "incidents", type_="foreignkey")
    op.drop_index(op.f("ix_incidents_deployment_id"), table_name="incidents")
    op.drop_column("incidents", "deployment_id")

    op.drop_index(op.f("ix_deployment_rollbacks_deployment_id"), table_name="deployment_rollbacks")
    op.drop_index("ix_deployment_rollbacks_deployment_id_rolled_back_at", table_name="deployment_rollbacks")
    op.drop_table("deployment_rollbacks")

    op.drop_index(op.f("ix_deployment_events_deployment_id"), table_name="deployment_events")
    op.drop_index("ix_deployment_events_deployment_id_created_at", table_name="deployment_events")
    op.drop_table("deployment_events")

    op.drop_index(op.f("ix_deployments_model_version_id"), table_name="deployments")
    op.drop_index(op.f("ix_deployments_prompt_version_id"), table_name="deployments")
    op.drop_index(op.f("ix_deployments_project_id"), table_name="deployments")
    op.drop_index("ix_deployments_project_deployed_at_desc", table_name="deployments")
    op.drop_table("deployments")
