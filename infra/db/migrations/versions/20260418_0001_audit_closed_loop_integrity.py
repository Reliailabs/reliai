"""audit closed-loop integrity

Revision ID: 20260418_0001
Revises: 20260411_0001
Create Date: 2026-04-18 16:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260418_0001"
down_revision: str | Sequence[str] | None = "20260411_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("target_system_name", sa.String(length=255), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("audit_type", sa.String(length=64), nullable=False),
        sa.Column("policy_profile", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("use_cases", sa.JSON(), nullable=True),
        sa.Column("workflow_summary", sa.Text(), nullable=True),
        sa.Column("endpoints_notes", sa.Text(), nullable=True),
        sa.Column("risk_focus_areas", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("environment", sa.String(length=64), nullable=True),
        sa.Column("linked_production_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("evidence_window_days", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("include_incidents", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("include_trace_samples", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("include_guardrail_violations", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("include_regressions", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("include_model_changes", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_audits_organization_id_organizations")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_audits_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audits")),
    )
    op.create_index(op.f("ix_audits_organization_id"), "audits", ["organization_id"], unique=False)
    op.create_index(op.f("ix_audits_project_id"), "audits", ["project_id"], unique=False)
    op.create_index(op.f("ix_audits_status"), "audits", ["status"], unique=False)

    op.create_table(
        "audit_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("audit_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("current_stage_key", sa.String(length=32), nullable=False, server_default="scoping"),
        sa.Column("risk_score", sa.Float(), nullable=True),
        sa.Column("certification_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("certification_effective_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence_window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence_window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("production_snapshot_metadata", sa.JSON(), nullable=True),
        sa.Column("snapshot_description", sa.Text(), nullable=True),
        sa.Column("snapshot_use_cases", sa.JSON(), nullable=True),
        sa.Column("snapshot_workflow_summary", sa.Text(), nullable=True),
        sa.Column("snapshot_endpoints_notes", sa.Text(), nullable=True),
        sa.Column("snapshot_risk_focus_areas", sa.JSON(), nullable=True),
        sa.Column("snapshot_target_system_name", sa.String(length=255), nullable=True),
        sa.Column("snapshot_environment", sa.String(length=64), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["audit_id"], ["audits.id"], name=op.f("fk_audit_runs_audit_id_audits")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_audit_runs_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_runs")),
    )
    op.create_index(op.f("ix_audit_runs_audit_id"), "audit_runs", ["audit_id"], unique=False)
    op.create_index(op.f("ix_audit_runs_organization_id"), "audit_runs", ["organization_id"], unique=False)
    op.create_index(op.f("ix_audit_runs_status"), "audit_runs", ["status"], unique=False)

    op.create_table(
        "audit_stages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("audit_run_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("internal_stage_key", sa.String(length=64), nullable=False),
        sa.Column("stage_key", sa.String(length=32), nullable=False),
        sa.Column("stage_label", sa.String(length=64), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="not_started"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("output_metadata", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["audit_run_id"], ["audit_runs.id"], name=op.f("fk_audit_stages_audit_run_id_audit_runs")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_audit_stages_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_stages")),
    )
    op.create_index(op.f("ix_audit_stages_audit_run_id"), "audit_stages", ["audit_run_id"], unique=False)
    op.create_index(op.f("ix_audit_stages_organization_id"), "audit_stages", ["organization_id"], unique=False)
    op.create_index(op.f("ix_audit_stages_stage_key"), "audit_stages", ["stage_key"], unique=False)

    op.create_table(
        "audit_findings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("audit_run_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("repro_steps", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("origin_source", sa.String(length=32), nullable=False, server_default="audit_test"),
        sa.Column("source_stage_key", sa.String(length=32), nullable=True),
        sa.Column("evidence_type", sa.String(length=64), nullable=True),
        sa.Column("evidence_ref", sa.String(length=255), nullable=True),
        sa.Column("finding_fingerprint", sa.String(length=128), nullable=True),
        sa.Column("is_validated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monitoring_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("certification_blocking", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("recommended_monitor_type", sa.String(length=64), nullable=True),
        sa.Column("recommended_scope", sa.String(length=255), nullable=True),
        sa.Column("recommended_threshold_hint", sa.String(length=255), nullable=True),
        sa.Column("is_stale", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["audit_run_id"], ["audit_runs.id"], name=op.f("fk_audit_findings_audit_run_id_audit_runs")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_audit_findings_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_findings")),
    )
    op.create_index(op.f("ix_audit_findings_audit_run_id"), "audit_findings", ["audit_run_id"], unique=False)
    op.create_index(op.f("ix_audit_findings_finding_fingerprint"), "audit_findings", ["finding_fingerprint"], unique=False)
    op.create_index(op.f("ix_audit_findings_organization_id"), "audit_findings", ["organization_id"], unique=False)
    op.create_index(op.f("ix_audit_findings_severity"), "audit_findings", ["severity"], unique=False)

    op.create_table(
        "audit_artifacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("audit_run_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("storage_ref", sa.String(length=255), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("is_stale", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["audit_run_id"], ["audit_runs.id"], name=op.f("fk_audit_artifacts_audit_run_id_audit_runs")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_audit_artifacts_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_artifacts")),
    )
    op.create_index(op.f("ix_audit_artifacts_artifact_type"), "audit_artifacts", ["artifact_type"], unique=False)
    op.create_index(op.f("ix_audit_artifacts_audit_run_id"), "audit_artifacts", ["audit_run_id"], unique=False)
    op.create_index(op.f("ix_audit_artifacts_organization_id"), "audit_artifacts", ["organization_id"], unique=False)

    op.create_table(
        "audit_finding_traces",
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["finding_id"], ["audit_findings.id"], name=op.f("fk_audit_finding_traces_finding_id_audit_findings")),
        sa.ForeignKeyConstraint(["trace_id"], ["traces.id"], name=op.f("fk_audit_finding_traces_trace_id_traces")),
        sa.PrimaryKeyConstraint("finding_id", "trace_id", name=op.f("pk_audit_finding_traces")),
    )

    op.create_table(
        "audit_finding_incidents",
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.Column("incident_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["finding_id"], ["audit_findings.id"], name=op.f("fk_audit_finding_incidents_finding_id_audit_findings")),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], name=op.f("fk_audit_finding_incidents_incident_id_incidents")),
        sa.PrimaryKeyConstraint("finding_id", "incident_id", name=op.f("pk_audit_finding_incidents")),
    )

    op.create_table(
        "project_audit_summaries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("latest_audit_id", sa.Uuid(), nullable=True),
        sa.Column("latest_audit_run_id", sa.Uuid(), nullable=True),
        sa.Column("certification_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("audit_risk_score", sa.Float(), nullable=True),
        sa.Column("audit_risk_level", sa.String(length=16), nullable=True),
        sa.Column("open_critical_findings_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("open_blocking_findings_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latest_audit_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certification_at_risk", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("certification_risk_reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["latest_audit_id"], ["audits.id"], name=op.f("fk_project_audit_summaries_latest_audit_id_audits")),
        sa.ForeignKeyConstraint(["latest_audit_run_id"], ["audit_runs.id"], name=op.f("fk_project_audit_summaries_latest_audit_run_id_audit_runs")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_project_audit_summaries_organization_id_organizations")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_project_audit_summaries_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_audit_summaries")),
        sa.UniqueConstraint("organization_id", "project_id", name="uq_project_audit_summaries_org_project"),
    )
    op.create_index(op.f("ix_project_audit_summaries_organization_id"), "project_audit_summaries", ["organization_id"], unique=False)
    op.create_index(op.f("ix_project_audit_summaries_project_id"), "project_audit_summaries", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_audit_summaries_project_id"), table_name="project_audit_summaries")
    op.drop_index(op.f("ix_project_audit_summaries_organization_id"), table_name="project_audit_summaries")
    op.drop_table("project_audit_summaries")
    op.drop_table("audit_finding_incidents")
    op.drop_table("audit_finding_traces")
    op.drop_index(op.f("ix_audit_artifacts_organization_id"), table_name="audit_artifacts")
    op.drop_index(op.f("ix_audit_artifacts_audit_run_id"), table_name="audit_artifacts")
    op.drop_index(op.f("ix_audit_artifacts_artifact_type"), table_name="audit_artifacts")
    op.drop_table("audit_artifacts")
    op.drop_index(op.f("ix_audit_findings_severity"), table_name="audit_findings")
    op.drop_index(op.f("ix_audit_findings_organization_id"), table_name="audit_findings")
    op.drop_index(op.f("ix_audit_findings_finding_fingerprint"), table_name="audit_findings")
    op.drop_index(op.f("ix_audit_findings_audit_run_id"), table_name="audit_findings")
    op.drop_table("audit_findings")
    op.drop_index(op.f("ix_audit_stages_stage_key"), table_name="audit_stages")
    op.drop_index(op.f("ix_audit_stages_organization_id"), table_name="audit_stages")
    op.drop_index(op.f("ix_audit_stages_audit_run_id"), table_name="audit_stages")
    op.drop_table("audit_stages")
    op.drop_index(op.f("ix_audit_runs_status"), table_name="audit_runs")
    op.drop_index(op.f("ix_audit_runs_organization_id"), table_name="audit_runs")
    op.drop_index(op.f("ix_audit_runs_audit_id"), table_name="audit_runs")
    op.drop_table("audit_runs")
    op.drop_index(op.f("ix_audits_status"), table_name="audits")
    op.drop_index(op.f("ix_audits_project_id"), table_name="audits")
    op.drop_index(op.f("ix_audits_organization_id"), table_name="audits")
    op.drop_table("audits")
