from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.audit import Audit
from app.models.audit_artifact import AuditArtifact
from app.models.audit_finding import AuditFinding
from app.models.audit_run import AuditRun
from app.models.deployment import Deployment
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.project import Project
from app.models.project_audit_summary import ProjectAuditSummary
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace


def validate_audit_project_linkage(db: Session, *, organization_id: UUID, project_id: UUID | None) -> Project | None:
    if project_id is None:
        return None
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise ValueError("Linked project not found for organization")
    return project


def _window_bounds(window_days: int) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=window_days)
    return start, end


def capture_production_evidence_snapshot(db: Session, *, audit: Audit, run: AuditRun) -> dict:
    if not audit.linked_production_enabled or audit.project_id is None:
        run.production_snapshot_metadata = None
        run.evidence_window_start = None
        run.evidence_window_end = None
        return {}

    start, end = _window_bounds(audit.evidence_window_days)
    project_id = audit.project_id
    metadata: dict[str, object] = {
        "window_days": audit.evidence_window_days,
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
    }

    artifact_rows: list[AuditArtifact] = []

    if audit.include_incidents:
        incidents = db.scalars(
            select(Incident).where(
                Incident.project_id == project_id,
                Incident.started_at >= start,
                Incident.started_at <= end,
            )
        ).all()
        critical = [item for item in incidents if (item.severity or "").lower() == "critical"]
        metadata["incident_count"] = len(incidents)
        metadata["critical_incident_count"] = len(critical)
        metadata["top_risky_workflows"] = [item.title for item in incidents[:3]]
        artifact_rows.append(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type="production_incident_summary",
                title="Production Incident Summary",
                storage_ref=None,
                metadata_json={
                    "count": len(incidents),
                    "critical_count": len(critical),
                },
            )
        )

    if audit.include_trace_samples:
        trace_samples = db.scalars(
            select(Trace)
            .where(
                Trace.project_id == project_id,
                Trace.timestamp >= start,
                Trace.timestamp <= end,
            )
            .order_by(desc(Trace.timestamp))
            .limit(50)
        ).all()
        metadata["trace_count_sampled"] = len(trace_samples)
        metadata["trace_services"] = sorted({item.service_name for item in trace_samples if item.service_name})[:5]
        artifact_rows.append(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type="production_trace_sample_bundle",
                title="Production Trace Sample Bundle",
                storage_ref=None,
                metadata_json={"sample_count": len(trace_samples)},
            )
        )

    if audit.include_guardrail_violations:
        guardrail_count = int(
            db.scalar(
                select(func.count(GuardrailRuntimeEvent.id))
                .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
                .where(
                    GuardrailPolicy.project_id == project_id,
                    GuardrailRuntimeEvent.created_at >= start,
                    GuardrailRuntimeEvent.created_at <= end,
                )
            )
            or 0
        )
        metadata["guardrail_violation_count"] = guardrail_count
        artifact_rows.append(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type="guardrail_violation_summary",
                title="Guardrail Violation Summary",
                storage_ref=None,
                metadata_json={"count": guardrail_count},
            )
        )

    if audit.include_regressions:
        regression_count = int(
            db.scalar(
                select(func.count(RegressionSnapshot.id)).where(
                    RegressionSnapshot.project_id == project_id,
                    RegressionSnapshot.detected_at >= start,
                    RegressionSnapshot.detected_at <= end,
                )
            )
            or 0
        )
        metadata["regression_event_count"] = regression_count
        artifact_rows.append(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type="regression_summary",
                title="Regression Summary",
                storage_ref=None,
                metadata_json={"count": regression_count},
            )
        )

    if audit.include_model_changes:
        deployment_rows = db.scalars(
            select(Deployment)
            .where(
                Deployment.project_id == project_id,
                Deployment.deployed_at >= start,
                Deployment.deployed_at <= end,
            )
            .order_by(desc(Deployment.deployed_at))
            .limit(20)
        ).all()
        metadata["model_change_count"] = len(deployment_rows)
        metadata["model_provider_version_summary"] = [
            {
                "provider": row.provider,
                "model_name": row.model_name,
                "model_version": row.model_version,
                "deployed_at": row.deployed_at.isoformat() if row.deployed_at else None,
            }
            for row in deployment_rows[:5]
        ]
        artifact_rows.append(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type="model_change_summary",
                title="Model Change Summary",
                storage_ref=None,
                metadata_json={"count": len(deployment_rows)},
            )
        )

    if artifact_rows:
        db.add_all(artifact_rows)

    run.evidence_window_start = start
    run.evidence_window_end = end
    run.production_snapshot_metadata = metadata

    return metadata


def derive_monitoring_recommendations(db: Session, *, run_id: UUID) -> list[dict]:
    findings = db.scalars(
        select(AuditFinding).where(
            AuditFinding.audit_run_id == run_id,
            AuditFinding.is_stale.is_(False),
            and_(AuditFinding.is_validated.is_(True), AuditFinding.monitoring_recommended.is_(True)),
        )
    ).all()

    recommendations: list[dict] = []
    for finding in findings:
        recommendations.append(
            {
                "id": str(finding.id),
                "finding_id": finding.id,
                "recommendation_type": finding.recommended_monitor_type or "output_reliability_watch",
                "scope": finding.recommended_scope,
                "threshold_hint": finding.recommended_threshold_hint,
                "reason": finding.summary,
            }
        )
    return recommendations


def _risk_level_from_score(score: float | None) -> str | None:
    if score is None:
        return None
    if score >= 80:
        return "low"
    if score >= 60:
        return "moderate"
    if score >= 40:
        return "high"
    return "critical"


def _compute_certification_at_risk(
    db: Session,
    *,
    project_id: UUID,
    certification_effective_at: datetime | None,
) -> tuple[bool, str | None]:
    if certification_effective_at is None:
        return False, None

    critical_incident_count = int(
        db.scalar(
            select(func.count(Incident.id)).where(
                Incident.project_id == project_id,
                Incident.started_at > certification_effective_at,
                func.lower(Incident.severity) == "critical",
            )
        )
        or 0
    )
    if critical_incident_count > 0:
        return True, "New critical production incident detected after certification."

    regression_count = int(
        db.scalar(
            select(func.count(RegressionSnapshot.id)).where(
                RegressionSnapshot.project_id == project_id,
                RegressionSnapshot.detected_at > certification_effective_at,
            )
        )
        or 0
    )
    if regression_count >= 3:
        return True, "Repeated regression events detected after certification."

    guardrail_spike = int(
        db.scalar(
            select(func.count(GuardrailRuntimeEvent.id))
            .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
            .where(
                GuardrailPolicy.project_id == project_id,
                GuardrailRuntimeEvent.created_at > certification_effective_at,
            )
        )
        or 0
    )
    if guardrail_spike >= 10:
        return True, "High-severity guardrail violation spike detected after certification."

    return False, None


def upsert_project_audit_summary(db: Session, *, run: AuditRun) -> ProjectAuditSummary | None:
    audit = run.audit
    if audit.project_id is None:
        return None

    open_critical = int(
        db.scalar(
            select(func.count(AuditFinding.id)).where(
                AuditFinding.audit_run_id == run.id,
                AuditFinding.is_stale.is_(False),
                func.lower(AuditFinding.severity) == "critical",
                func.lower(AuditFinding.status) == "open",
            )
        )
        or 0
    )
    open_blocking = int(
        db.scalar(
            select(func.count(AuditFinding.id)).where(
                AuditFinding.audit_run_id == run.id,
                AuditFinding.is_stale.is_(False),
                AuditFinding.certification_blocking.is_(True),
                func.lower(AuditFinding.status) == "open",
            )
        )
        or 0
    )

    at_risk, reason = _compute_certification_at_risk(
        db,
        project_id=audit.project_id,
        certification_effective_at=run.certification_effective_at,
    )

    summary = db.scalar(
        select(ProjectAuditSummary).where(
            ProjectAuditSummary.organization_id == run.organization_id,
            ProjectAuditSummary.project_id == audit.project_id,
        )
    )
    if summary is None:
        summary = ProjectAuditSummary(
            organization_id=run.organization_id,
            project_id=audit.project_id,
        )
        db.add(summary)

    summary.latest_audit_id = audit.id
    summary.latest_audit_run_id = run.id
    summary.certification_status = run.certification_status
    summary.audit_risk_score = run.risk_score
    summary.audit_risk_level = _risk_level_from_score(run.risk_score)
    summary.open_critical_findings_count = open_critical
    summary.open_blocking_findings_count = open_blocking
    summary.latest_audit_completed_at = run.completed_at
    summary.certification_at_risk = at_risk
    summary.certification_risk_reason = reason
    return summary


def get_project_audit_summary(db: Session, *, organization_id: UUID, project_id: UUID) -> ProjectAuditSummary | None:
    summary = db.scalar(
        select(ProjectAuditSummary).where(
            ProjectAuditSummary.organization_id == organization_id,
            ProjectAuditSummary.project_id == project_id,
        )
    )
    if summary is None:
        return None

    at_risk, reason = _compute_certification_at_risk(
        db,
        project_id=project_id,
        certification_effective_at=summary.latest_audit_completed_at,
    )
    summary.certification_at_risk = at_risk
    summary.certification_risk_reason = reason
    db.flush()
    return summary
