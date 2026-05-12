"""phase 11 — operations center persistence tables

Adds five tables for Phase 10/11 Operations Center persistence:
  - proposal_lifecycle_records       (mutable lifecycle state)
  - lifecycle_transition_history     (append-only state transitions)
  - operations_timeline_events       (append-only audit trail)
  - verification_result_records      (append-only verification outcomes)
  - reliability_score_snapshots      (append-only score computations)

Key invariants enforced at DB level:
  - execution_granted = FALSE on proposal_lifecycle_records (CHECK constraint)
  - requires_operator_review = TRUE on all five tables (CHECK constraint)
  - idempotency_key UNIQUE on all five tables (safe-to-retry inserts)

Revision ID: 20260512_0001
Revises: 20260418_0001
Create Date: 2026-05-12 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260512_0001"
down_revision: str | Sequence[str] | None = "20260418_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── proposal_lifecycle_records ────────────────────────────────────────────
    # Mutable. One row per proposal lifecycle. Updated in-place on transitions.
    op.create_table(
        "proposal_lifecycle_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lifecycle_id", sa.String(length=64), nullable=False),
        sa.Column("proposal_id", sa.String(length=128), nullable=False),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=128), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=False),
        # Governance invariant: never true. Enforced by CHECK.
        sa.Column(
            "execution_granted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "requires_operator_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("operator_email", sa.String(length=255), nullable=True),
        # Soft ref — set after verification_result_records row is written.
        sa.Column("verification_result_id", sa.String(length=128), nullable=True),
        # Receipt ID emitted immediately after operator approval.
        sa.Column("audit_receipt_id", sa.String(length=128), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "execution_granted = FALSE",
            name="ck_proposal_lifecycle_records_execution_granted_false",
        ),
        sa.CheckConstraint(
            "requires_operator_review = TRUE",
            name="ck_proposal_lifecycle_records_requires_operator_review_true",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_proposal_lifecycle_records_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_proposal_lifecycle_records_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_proposal_lifecycle_records")),
        sa.UniqueConstraint(
            "lifecycle_id",
            name="uq_proposal_lifecycle_records_lifecycle_id",
        ),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_proposal_lifecycle_records_idempotency_key",
        ),
    )
    op.create_index(
        op.f("ix_proposal_lifecycle_records_organization_id"),
        "proposal_lifecycle_records",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_proposal_lifecycle_records_project_id"),
        "proposal_lifecycle_records",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_proposal_lifecycle_records_state"),
        "proposal_lifecycle_records",
        ["state"],
        unique=False,
    )
    op.create_index(
        op.f("ix_proposal_lifecycle_records_proposal_id"),
        "proposal_lifecycle_records",
        ["proposal_id"],
        unique=False,
    )

    # ── lifecycle_transition_history ──────────────────────────────────────────
    # Append-only. One row per state transition. Never updated.
    op.create_table(
        "lifecycle_transition_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        # Soft ref — no FK to proposal_lifecycle_records (written in same txn).
        sa.Column("lifecycle_id", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("from_state", sa.String(length=32), nullable=False),
        sa.Column("to_state", sa.String(length=32), nullable=False),
        sa.Column("transitioned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        # sha256(lifecycle_id + ":" + from_state + ":" + to_state + ":" + transitioned_at)
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        # No updated_at — append-only invariant.
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_lifecycle_transition_history_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lifecycle_transition_history")),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_lifecycle_transition_history_idempotency_key",
        ),
    )
    op.create_index(
        op.f("ix_lifecycle_transition_history_lifecycle_id"),
        "lifecycle_transition_history",
        ["lifecycle_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lifecycle_transition_history_organization_id"),
        "lifecycle_transition_history",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lifecycle_transition_history_to_state"),
        "lifecycle_transition_history",
        ["to_state"],
        unique=False,
    )

    # ── operations_timeline_events ────────────────────────────────────────────
    # Append-only audit trail. Never updated.
    op.create_table(
        "operations_timeline_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entry_id", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        # Soft refs — events may be written before lifecycle/proposal rows commit.
        sa.Column("lifecycle_id", sa.String(length=64), nullable=True),
        sa.Column("proposal_id", sa.String(length=128), nullable=True),
        sa.Column("incident_id", sa.String(length=128), nullable=True),
        sa.Column("severity", sa.String(length=16), nullable=True),
        sa.Column("lifecycle_state", sa.String(length=32), nullable=True),
        sa.Column("actor_type", sa.String(length=16), nullable=False),
        sa.Column("actor_label", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("policy_gate_result", sa.String(length=16), nullable=True),
        # Array<{label: string, href: string}>
        sa.Column(
            "evidence_refs",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "requires_operator_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        # = entry_id (already a deterministic sha256 hash)
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        # No updated_at — append-only invariant.
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "requires_operator_review = TRUE",
            name="ck_operations_timeline_events_requires_operator_review_true",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_operations_timeline_events_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_operations_timeline_events_project_id_projects"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_operations_timeline_events")),
        sa.UniqueConstraint(
            "entry_id",
            name="uq_operations_timeline_events_entry_id",
        ),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_operations_timeline_events_idempotency_key",
        ),
    )
    op.create_index(
        op.f("ix_operations_timeline_events_organization_id"),
        "operations_timeline_events",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_project_id"),
        "operations_timeline_events",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_kind"),
        "operations_timeline_events",
        ["kind"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_occurred_at"),
        "operations_timeline_events",
        ["occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_lifecycle_id"),
        "operations_timeline_events",
        ["lifecycle_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_proposal_id"),
        "operations_timeline_events",
        ["proposal_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_incident_id"),
        "operations_timeline_events",
        ["incident_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operations_timeline_events_policy_gate_result"),
        "operations_timeline_events",
        ["policy_gate_result"],
        unique=False,
    )

    # ── verification_result_records ───────────────────────────────────────────
    # Append-only. One row per verification run. Never updated.
    op.create_table(
        "verification_result_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("result_id", sa.String(length=64), nullable=False),
        # Soft ref — verification may be computed in a separate service call.
        sa.Column("lifecycle_id", sa.String(length=64), nullable=False),
        sa.Column("proposal_id", sa.String(length=128), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.String(length=16), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        # Scalar metrics stored as typed columns for SQL aggregation.
        sa.Column("error_rate_before_pct", sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column("error_rate_after_pct", sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column("error_rate_delta_pp", sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column("latency_p99_before_ms", sa.Integer(), nullable=False),
        sa.Column("latency_p99_after_ms", sa.Integer(), nullable=False),
        sa.Column("latency_delta_pct", sa.Numeric(precision=6, scale=2), nullable=False),
        # GateCheck[] — named pass/fail checks
        sa.Column("gate_checks", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "requires_operator_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        # = result_id (already a deterministic sha256 hash)
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        # No updated_at — append-only invariant.
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "requires_operator_review = TRUE",
            name="ck_verification_result_records_requires_operator_review_true",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_verification_result_records_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_verification_result_records")),
        sa.UniqueConstraint(
            "result_id",
            name="uq_verification_result_records_result_id",
        ),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_verification_result_records_idempotency_key",
        ),
    )
    op.create_index(
        op.f("ix_verification_result_records_organization_id"),
        "verification_result_records",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_verification_result_records_lifecycle_id"),
        "verification_result_records",
        ["lifecycle_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_verification_result_records_outcome"),
        "verification_result_records",
        ["outcome"],
        unique=False,
    )
    op.create_index(
        op.f("ix_verification_result_records_computed_at"),
        "verification_result_records",
        ["computed_at"],
        unique=False,
    )

    # ── reliability_score_snapshots ───────────────────────────────────────────
    # Append-only. One row per score computation. Never updated.
    op.create_table(
        "reliability_score_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("score_id", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        # Scalar dimension scores — queryable without JSON parsing.
        sa.Column("overall", sa.SmallInteger(), nullable=False),
        sa.Column("overall_grade", sa.String(length=1), nullable=False),
        sa.Column("operational_score", sa.SmallInteger(), nullable=False),
        sa.Column("automation_confidence", sa.SmallInteger(), nullable=False),
        sa.Column("recovery_performance", sa.SmallInteger(), nullable=False),
        sa.Column("policy_safety_score", sa.SmallInteger(), nullable=False),
        # Full ScoredDimension objects with factor breakdowns — for UI explainability.
        sa.Column("dimensions", sa.JSON(), nullable=False),
        # ReliabilityTrendPoint[] 7-day sparkline — not persisted separately.
        sa.Column("trend", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "requires_operator_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        # = score_id (already a deterministic sha256 hash)
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        # No updated_at — append-only invariant.
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "overall BETWEEN 0 AND 100",
            name="ck_reliability_score_snapshots_overall_range",
        ),
        sa.CheckConstraint(
            "overall_grade IN ('A', 'B', 'C', 'D', 'F')",
            name="ck_reliability_score_snapshots_overall_grade_values",
        ),
        sa.CheckConstraint(
            "requires_operator_review = TRUE",
            name="ck_reliability_score_snapshots_requires_operator_review_true",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_reliability_score_snapshots_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reliability_score_snapshots")),
        sa.UniqueConstraint(
            "score_id",
            name="uq_reliability_score_snapshots_score_id",
        ),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_reliability_score_snapshots_idempotency_key",
        ),
    )
    op.create_index(
        op.f("ix_reliability_score_snapshots_organization_id"),
        "reliability_score_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reliability_score_snapshots_computed_at"),
        "reliability_score_snapshots",
        ["computed_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reliability_score_snapshots_overall"),
        "reliability_score_snapshots",
        ["overall"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_reliability_score_snapshots_overall"),
        table_name="reliability_score_snapshots",
    )
    op.drop_index(
        op.f("ix_reliability_score_snapshots_computed_at"),
        table_name="reliability_score_snapshots",
    )
    op.drop_index(
        op.f("ix_reliability_score_snapshots_organization_id"),
        table_name="reliability_score_snapshots",
    )
    op.drop_table("reliability_score_snapshots")

    op.drop_index(
        op.f("ix_verification_result_records_computed_at"),
        table_name="verification_result_records",
    )
    op.drop_index(
        op.f("ix_verification_result_records_outcome"),
        table_name="verification_result_records",
    )
    op.drop_index(
        op.f("ix_verification_result_records_lifecycle_id"),
        table_name="verification_result_records",
    )
    op.drop_index(
        op.f("ix_verification_result_records_organization_id"),
        table_name="verification_result_records",
    )
    op.drop_table("verification_result_records")

    op.drop_index(
        op.f("ix_operations_timeline_events_policy_gate_result"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_incident_id"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_proposal_id"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_lifecycle_id"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_occurred_at"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_kind"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_project_id"),
        table_name="operations_timeline_events",
    )
    op.drop_index(
        op.f("ix_operations_timeline_events_organization_id"),
        table_name="operations_timeline_events",
    )
    op.drop_table("operations_timeline_events")

    op.drop_index(
        op.f("ix_lifecycle_transition_history_to_state"),
        table_name="lifecycle_transition_history",
    )
    op.drop_index(
        op.f("ix_lifecycle_transition_history_organization_id"),
        table_name="lifecycle_transition_history",
    )
    op.drop_index(
        op.f("ix_lifecycle_transition_history_lifecycle_id"),
        table_name="lifecycle_transition_history",
    )
    op.drop_table("lifecycle_transition_history")

    op.drop_index(
        op.f("ix_proposal_lifecycle_records_proposal_id"),
        table_name="proposal_lifecycle_records",
    )
    op.drop_index(
        op.f("ix_proposal_lifecycle_records_state"),
        table_name="proposal_lifecycle_records",
    )
    op.drop_index(
        op.f("ix_proposal_lifecycle_records_project_id"),
        table_name="proposal_lifecycle_records",
    )
    op.drop_index(
        op.f("ix_proposal_lifecycle_records_organization_id"),
        table_name="proposal_lifecycle_records",
    )
    op.drop_table("proposal_lifecycle_records")
