"""reliability recommendations

Revision ID: 20260310_0020
Revises: 20260310_0019
Create Date: 2026-03-10 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260310_0020"
down_revision: str | None = "20260310_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reliability_recommendations",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("recommendation_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=600), nullable=False),
        sa.Column("evidence_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_reliability_recommendations_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_recommendations")),
    )
    op.create_index(
        "ix_reliability_recommendations_project_created_at",
        "reliability_recommendations",
        ["project_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reliability_recommendations_project_type_created_at",
        "reliability_recommendations",
        ["project_id", "recommendation_type", "created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reliability_recommendations_project_id"),
        "reliability_recommendations",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_reliability_recommendations_project_id"), table_name="reliability_recommendations")
    op.drop_index("ix_reliability_recommendations_project_type_created_at", table_name="reliability_recommendations")
    op.drop_index("ix_reliability_recommendations_project_created_at", table_name="reliability_recommendations")
    op.drop_table("reliability_recommendations")
