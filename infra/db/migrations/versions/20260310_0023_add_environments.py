"""add environments

Revision ID: 20260310_0023
Revises: 20260310_0022a
Create Date: 2026-03-10 12:00:00.000000
"""

from collections.abc import Sequence
from datetime import datetime, timezone
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260310_0023"
down_revision: str | Sequence[str] | None = "20260310_0022a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


environment_type = postgresql.ENUM(
    "production",
    "staging",
    "development",
    name="environment_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    environment_type.create(bind, checkfirst=True)
    op.create_table(
        "environments",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("type", environment_type, nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_environments_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_environments")),
        sa.UniqueConstraint("project_id", "name", name="uq_environments_project_name"),
    )
    op.create_index(op.f("ix_environments_project_id"), "environments", ["project_id"], unique=False)

    for table_name in (
        "traces",
        "incidents",
        "deployments",
        "guardrail_policies",
        "guardrail_runtime_events",
        "deployment_simulations",
        "deployment_risk_scores",
    ):
        op.add_column(table_name, sa.Column("environment_id", sa.Uuid(), nullable=True))
        op.create_index(op.f(f"ix_{table_name}_environment_id"), table_name, ["environment_id"], unique=False)
        op.create_foreign_key(
            op.f(f"fk_{table_name}_environment_id_environments"),
            table_name,
            "environments",
            ["environment_id"],
            ["id"],
        )

    project_rows = bind.execute(sa.text("SELECT id FROM projects")).fetchall()
    environment_ids_by_project: dict[str, str] = {}
    for row in project_rows:
        environment_id = str(uuid.uuid4())
        environment_ids_by_project[str(row.id)] = environment_id
        bind.execute(
            sa.text(
                """
                INSERT INTO environments (id, project_id, name, type, created_at)
                VALUES (:id, :project_id, :name, :type, :created_at)
                """
            ),
            {
                "id": environment_id,
                "project_id": str(row.id),
                "name": "production",
                "type": "production",
                "created_at": datetime.now(timezone.utc),
            },
        )

    if environment_ids_by_project:
        for project_id, environment_id in environment_ids_by_project.items():
            bind.execute(
                sa.text("UPDATE traces SET environment_id = :environment_id WHERE project_id = :project_id"),
                {"environment_id": environment_id, "project_id": project_id},
            )
            bind.execute(
                sa.text("UPDATE incidents SET environment_id = :environment_id WHERE project_id = :project_id"),
                {"environment_id": environment_id, "project_id": project_id},
            )
            bind.execute(
                sa.text("UPDATE deployments SET environment_id = :environment_id WHERE project_id = :project_id"),
                {"environment_id": environment_id, "project_id": project_id},
            )
            bind.execute(
                sa.text("UPDATE guardrail_policies SET environment_id = :environment_id WHERE project_id = :project_id"),
                {"environment_id": environment_id, "project_id": project_id},
            )
            bind.execute(
                sa.text(
                    """
                    UPDATE guardrail_runtime_events
                    SET environment_id = :environment_id
                    WHERE policy_id IN (
                        SELECT id FROM guardrail_policies WHERE project_id = :project_id
                    )
                    """
                ),
                {"environment_id": environment_id, "project_id": project_id},
            )
            bind.execute(
                sa.text("UPDATE deployment_simulations SET environment_id = :environment_id WHERE project_id = :project_id"),
                {"environment_id": environment_id, "project_id": project_id},
            )
            bind.execute(
                sa.text(
                    """
                    UPDATE deployment_risk_scores
                    SET environment_id = :environment_id
                    WHERE deployment_id IN (
                        SELECT id FROM deployments WHERE project_id = :project_id
                    )
                    """
                ),
                {"environment_id": environment_id, "project_id": project_id},
            )

    for table_name in (
        "traces",
        "incidents",
        "deployments",
        "guardrail_policies",
        "guardrail_runtime_events",
        "deployment_simulations",
        "deployment_risk_scores",
    ):
        op.alter_column(table_name, "environment_id", nullable=False)


def downgrade() -> None:
    for table_name in (
        "deployment_risk_scores",
        "deployment_simulations",
        "guardrail_runtime_events",
        "guardrail_policies",
        "deployments",
        "incidents",
        "traces",
    ):
        op.drop_constraint(op.f(f"fk_{table_name}_environment_id_environments"), table_name, type_="foreignkey")
        op.drop_index(op.f(f"ix_{table_name}_environment_id"), table_name=table_name)
        op.drop_column(table_name, "environment_id")

    op.drop_index(op.f("ix_environments_project_id"), table_name="environments")
    op.drop_table("environments")
    environment_type.drop(op.get_bind(), checkfirst=True)
