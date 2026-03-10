"""reliability graph layer

Revision ID: 20260309_0011
Revises: 20260309_0010
Create Date: 2026-03-09 23:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260309_0011"
down_revision: str | None = "20260309_0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trace_evaluations",
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.Column("evaluation_type", sa.String(length=64), nullable=False),
        sa.Column("score", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["trace_id"], ["traces.id"], name=op.f("fk_trace_evaluations_trace_id_traces")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trace_evaluations")),
        sa.UniqueConstraint("trace_id", "evaluation_type", name="uq_trace_evaluations_trace_type"),
    )
    op.create_index("ix_trace_evaluations_trace_id", "trace_evaluations", ["trace_id"], unique=False)

    op.create_table(
        "trace_retrieval_spans",
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.Column("retrieval_provider", sa.String(length=120), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["trace_id"], ["traces.id"], name=op.f("fk_trace_retrieval_spans_trace_id_traces")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trace_retrieval_spans")),
        sa.UniqueConstraint("trace_id", name="uq_trace_retrieval_spans_trace_id"),
    )
    op.create_index("ix_trace_retrieval_spans_trace_id", "trace_retrieval_spans", ["trace_id"], unique=False)

    op.create_table(
        "incident_root_causes",
        sa.Column("incident_id", sa.Uuid(), nullable=False),
        sa.Column("cause_type", sa.String(length=64), nullable=False),
        sa.Column("cause_id", sa.String(length=255), nullable=False),
        sa.Column("confidence_score", sa.Numeric(precision=8, scale=6), nullable=True),
        sa.Column("evidence_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], name=op.f("fk_incident_root_causes_incident_id_incidents")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_incident_root_causes")),
    )
    op.create_index("ix_incident_root_causes_incident_id", "incident_root_causes", ["incident_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_incident_root_causes_incident_id", table_name="incident_root_causes")
    op.drop_table("incident_root_causes")
    op.drop_index("ix_trace_retrieval_spans_trace_id", table_name="trace_retrieval_spans")
    op.drop_table("trace_retrieval_spans")
    op.drop_index("ix_trace_evaluations_trace_id", table_name="trace_evaluations")
    op.drop_table("trace_evaluations")
