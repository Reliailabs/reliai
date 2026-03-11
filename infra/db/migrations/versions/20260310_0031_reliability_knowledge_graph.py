"""reliability knowledge graph

Revision ID: 20260310_0031
Revises: 20260310_0030
Create Date: 2026-03-10 23:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0031"
down_revision: str | Sequence[str] | None = "20260310_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reliability_graph_nodes",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("node_type", sa.String(length=64), nullable=False),
        sa.Column("node_key", sa.String(length=255), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_count", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_reliability_graph_nodes_organization_id_organizations")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_reliability_graph_nodes_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_graph_nodes")),
        sa.UniqueConstraint(
            "organization_id",
            "project_id",
            "node_type",
            "node_key",
            name="uq_reliability_graph_nodes_scope_key",
        ),
    )
    op.create_index("ix_reliability_graph_nodes_type_key", "reliability_graph_nodes", ["node_type", "node_key"], unique=False)
    op.create_index("ix_reliability_graph_nodes_trace_count", "reliability_graph_nodes", ["trace_count"], unique=False)

    op.create_table(
        "reliability_graph_edges",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("relationship_type", sa.String(length=64), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("trace_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_reliability_graph_edges_organization_id_organizations")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_reliability_graph_edges_project_id_projects")),
        sa.ForeignKeyConstraint(["source_id"], ["reliability_graph_nodes.id"], name=op.f("fk_reliability_graph_edges_source_id_reliability_graph_nodes")),
        sa.ForeignKeyConstraint(["target_id"], ["reliability_graph_nodes.id"], name=op.f("fk_reliability_graph_edges_target_id_reliability_graph_nodes")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_graph_edges")),
        sa.UniqueConstraint(
            "organization_id",
            "project_id",
            "source_id",
            "target_id",
            "relationship_type",
            name="uq_reliability_graph_edges_scope_relationship",
        ),
    )
    op.create_index("ix_reliability_graph_edges_source_type", "reliability_graph_edges", ["source_type", "weight"], unique=False)
    op.create_index("ix_reliability_graph_edges_target_type", "reliability_graph_edges", ["target_type", "confidence"], unique=False)
    op.create_index("ix_reliability_graph_edges_weight_confidence", "reliability_graph_edges", ["weight", "confidence"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_reliability_graph_edges_weight_confidence", table_name="reliability_graph_edges")
    op.drop_index("ix_reliability_graph_edges_target_type", table_name="reliability_graph_edges")
    op.drop_index("ix_reliability_graph_edges_source_type", table_name="reliability_graph_edges")
    op.drop_table("reliability_graph_edges")
    op.drop_index("ix_reliability_graph_nodes_trace_count", table_name="reliability_graph_nodes")
    op.drop_index("ix_reliability_graph_nodes_type_key", table_name="reliability_graph_nodes")
    op.drop_table("reliability_graph_nodes")
