"""trace explorer and evaluation scaffold

Revision ID: 20260309_0002
Revises: 20260309_0001
Create Date: 2026-03-09 00:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0002"
down_revision = "20260309_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("traces", sa.Column("organization_id", sa.Uuid(), nullable=True))
    op.add_column("traces", sa.Column("environment", sa.String(length=32), nullable=True))
    op.add_column("traces", sa.Column("input_preview", sa.Text(), nullable=True))
    op.add_column("traces", sa.Column("output_preview", sa.Text(), nullable=True))
    op.create_foreign_key(
        op.f("fk_traces_organization_id_organizations"),
        "traces",
        "organizations",
        ["organization_id"],
        ["id"],
    )
    op.create_index(op.f("ix_traces_organization_id"), "traces", ["organization_id"], unique=False)

    op.execute(
        """
        UPDATE traces
        SET organization_id = projects.organization_id,
            environment = projects.environment
        FROM projects
        WHERE traces.project_id = projects.id
        """
    )

    op.alter_column("traces", "organization_id", nullable=False)
    op.alter_column("traces", "environment", nullable=False)

    op.create_index(
        "ix_traces_organization_created_at",
        "traces",
        ["organization_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_traces_project_prompt_version_created_at",
        "traces",
        ["project_id", "prompt_version", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_traces_project_model_name_created_at",
        "traces",
        ["project_id", "model_name", "created_at"],
        unique=False,
    )

    op.create_table(
        "retrieval_spans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.Column("retrieval_latency_ms", sa.Integer(), nullable=True),
        sa.Column("source_count", sa.Integer(), nullable=True),
        sa.Column("top_k", sa.Integer(), nullable=True),
        sa.Column("query_text", sa.Text(), nullable=True),
        sa.Column("retrieved_chunks_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["trace_id"], ["traces.id"], name=op.f("fk_retrieval_spans_trace_id_traces")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_retrieval_spans")),
        sa.UniqueConstraint("trace_id", name=op.f("uq_retrieval_spans_trace_id")),
    )
    op.create_index(
        op.f("ix_retrieval_spans_trace_id"), "retrieval_spans", ["trace_id"], unique=False
    )

    op.create_table(
        "evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("eval_type", sa.String(length=64), nullable=False),
        sa.Column("score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("label", sa.String(length=32), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("evaluator_provider", sa.String(length=64), nullable=True),
        sa.Column("evaluator_model", sa.String(length=128), nullable=True),
        sa.Column("evaluator_version", sa.String(length=64), nullable=True),
        sa.Column("raw_result_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name=op.f("fk_evaluations_project_id_projects")
        ),
        sa.ForeignKeyConstraint(
            ["trace_id"], ["traces.id"], name=op.f("fk_evaluations_trace_id_traces")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evaluations")),
        sa.UniqueConstraint("trace_id", "eval_type", name="uq_evaluations_trace_eval_type"),
    )
    op.create_index(op.f("ix_evaluations_project_id"), "evaluations", ["project_id"], unique=False)
    op.create_index(op.f("ix_evaluations_trace_id"), "evaluations", ["trace_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_evaluations_trace_id"), table_name="evaluations")
    op.drop_index(op.f("ix_evaluations_project_id"), table_name="evaluations")
    op.drop_table("evaluations")

    op.drop_index(op.f("ix_retrieval_spans_trace_id"), table_name="retrieval_spans")
    op.drop_table("retrieval_spans")

    op.drop_index("ix_traces_project_model_name_created_at", table_name="traces")
    op.drop_index("ix_traces_project_prompt_version_created_at", table_name="traces")
    op.drop_index("ix_traces_organization_created_at", table_name="traces")
    op.drop_index(op.f("ix_traces_organization_id"), table_name="traces")
    op.drop_constraint(op.f("fk_traces_organization_id_organizations"), "traces", type_="foreignkey")
    op.drop_column("traces", "output_preview")
    op.drop_column("traces", "input_preview")
    op.drop_column("traces", "environment")
    op.drop_column("traces", "organization_id")
