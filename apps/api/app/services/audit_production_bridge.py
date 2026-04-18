from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.audit import Audit
from app.models.audit_artifact import AuditArtifact
from app.models.audit_finding import AuditFinding
from app.models.audit_run import AuditRun
from app.models.audit_stage import AuditStage
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
        "evidenceWindow": {
            "days": audit.evidence_window_days,
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
        "incidentSummary": {"count": 0, "criticalCount": 0},
        "traceSampleSummary": {"sampleCount": 0, "services": []},
        "guardrailViolationSummary": {"count": 0},
        "regressionSummary": {"count": 0},
        "modelChangeSummary": {"count": 0, "models": []},
        "topRiskySurfaces": [],
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
        metadata["incidentSummary"] = {
            "count": len(incidents),
            "criticalCount": len(critical),
        }
        metadata["topRiskySurfaces"] = [item.title for item in incidents[:3]]
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
        metadata["traceSampleSummary"] = {
            "sampleCount": len(trace_samples),
            "services": sorted({item.service_name for item in trace_samples if item.service_name})[:5],
        }
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
        metadata["guardrailViolationSummary"] = {"count": guardrail_count}
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
        metadata["regressionSummary"] = {"count": regression_count}
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
        metadata["modelChangeSummary"] = {
            "count": len(deployment_rows),
            "models": [
                {
                    "provider": row.provider,
                    "modelName": row.model_name,
                    "modelVersion": row.model_version,
                    "deployedAt": row.deployed_at.isoformat() if row.deployed_at else None,
                }
                for row in deployment_rows[:5]
            ],
        }
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


def _latest_project_run(db: Session, *, organization_id: UUID, project_id: UUID) -> AuditRun | None:
    return db.scalar(
        select(AuditRun)
        .join(Audit, Audit.id == AuditRun.audit_id)
        .where(
            AuditRun.organization_id == organization_id,
            Audit.organization_id == organization_id,
            Audit.project_id == project_id,
        )
        .order_by(desc(AuditRun.created_at), desc(AuditRun.id))
    )


def _summary_is_fresh(db: Session, *, summary: ProjectAuditSummary, latest_run: AuditRun | None) -> bool:
    if summary.certification_status == "pending":
        return False
    if summary.latest_audit_run_id is None:
        return False
    if summary.latest_audit_completed_at is None:
        return False
    if latest_run is None:
        return False
    if latest_run.id != summary.latest_audit_run_id:
        # A newer run exists or summary points to a non-latest run.
        return False
    if latest_run.status != "completed":
        return False
    if latest_run.certification_status == "pending":
        return False
    has_incomplete_downstream = db.scalar(
        select(func.count(AuditStage.id)).where(
            AuditStage.audit_run_id == latest_run.id,
            AuditStage.stage_order > 1,
            AuditStage.status.in_(["not_started", "queued", "running", "failed"]),
        )
    ) or 0
    return has_incomplete_downstream == 0


def get_project_audit_summary(db: Session, *, organization_id: UUID, project_id: UUID) -> ProjectAuditSummary | None:
    summary = db.scalar(
        select(ProjectAuditSummary).where(
            ProjectAuditSummary.organization_id == organization_id,
            ProjectAuditSummary.project_id == project_id,
        )
    )
    if summary is None:
        return None

    latest_run = _latest_project_run(db, organization_id=organization_id, project_id=project_id)

    at_risk, reason = _compute_certification_at_risk(
        db,
        project_id=project_id,
        certification_effective_at=summary.latest_audit_completed_at,
    )
    summary.certification_at_risk = at_risk
    if not _summary_is_fresh(db, summary=summary, latest_run=latest_run):
        summary.certification_status = "pending"
        summary.certification_risk_reason = "A newer run is in progress or has invalidated the latest completed certification."
        if latest_run is not None:
            summary.latest_audit_id = latest_run.audit_id
            summary.latest_audit_run_id = latest_run.id
    else:
        summary.certification_risk_reason = reason
    db.flush()
    return summary
