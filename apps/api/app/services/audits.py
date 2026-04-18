from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha1
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.audit import Audit
from app.models.audit_artifact import AuditArtifact
from app.models.audit_finding import AuditFinding
from app.models.audit_run import AuditRun
from app.models.audit_stage import AuditStage
from app.models.project_audit_summary import ProjectAuditSummary
from app.schemas.audit import (
    AuditCreateRequest,
    AuditDetailResponse,
    AuditListItemRead,
    AuditListResponse,
    AuditResultsRead,
    AuditRunRead,
    AuditRunListResponse,
    FindingsSummaryRead,
)
from app.schemas.audit_enums import (
    AuditFindingStatus,
    AuditRunStatus,
    AuditSeverity,
    AuditStageKey,
    AuditStageStatus,
    AuditStatus,
    CertificationStatus,
)
from app.services.audit_executor import AuditStageExecutor, DeterministicMockAuditStageExecutor
from app.services.audit_production_bridge import (
    capture_production_evidence_snapshot,
    derive_monitoring_recommendations,
    upsert_project_audit_summary,
    validate_audit_project_linkage,
)


@dataclass(frozen=True)
class StageDefinition:
    order: int
    internal_stage_key: str
    stage_key: str
    stage_label: str
    description: str


STAGE_DEFINITIONS: list[StageDefinition] = [
    StageDefinition(1, "scope_analyst", AuditStageKey.SCOPING.value, "Scoping", "Define scope and risk boundaries."),
    StageDefinition(2, "compliance_auditor", AuditStageKey.TESTING.value, "Testing", "Stress test reliability and safety paths."),
    StageDefinition(3, "model_qa_specialist", AuditStageKey.VALIDATION.value, "Validation", "Validate findings and remove false positives."),
    StageDefinition(4, "compliance_review_bureau", AuditStageKey.REVIEW.value, "Review", "Normalize severity and consolidate systemic risk."),
    StageDefinition(5, "certification_authority", AuditStageKey.CERTIFICATION.value, "Certification", "Issue decision and remediation guidance."),
]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_policy_profile(payload: AuditCreateRequest) -> str:
    return (payload.policy_profile or payload.audit_type).value


def _default_executor() -> AuditStageExecutor:
    return DeterministicMockAuditStageExecutor()


def _artifact_source_stage_key(artifact: AuditArtifact) -> str | None:
    metadata = artifact.metadata_json or {}
    source_stage = metadata.get("source_stage_key")
    return str(source_stage) if source_stage is not None else None


def _recommendation_from_finding(finding: AuditFinding) -> str:
    scope = finding.recommended_scope or finding.evidence_ref or finding.category
    if finding.certification_blocking:
        return f"Resolve blocker: {finding.title} in {scope}."
    return f"Reduce risk: {finding.title} in {scope}."


def _seed_run_stages(db: Session, *, run: AuditRun) -> list[AuditStage]:
    stages = [
        AuditStage(
            audit_run_id=run.id,
            organization_id=run.organization_id,
            internal_stage_key=item.internal_stage_key,
            stage_key=item.stage_key,
            stage_label=item.stage_label,
            stage_order=item.order,
            status=AuditStageStatus.NOT_STARTED.value,
            summary=item.description,
            output_metadata=None,
        )
        for item in STAGE_DEFINITIONS
    ]
    db.add_all(stages)
    db.flush()
    return stages


def _snapshot_run_inputs(run: AuditRun, audit: Audit) -> None:
    run.snapshot_description = audit.description
    run.snapshot_use_cases = audit.use_cases
    run.snapshot_workflow_summary = audit.workflow_summary
    run.snapshot_endpoints_notes = audit.endpoints_notes
    run.snapshot_risk_focus_areas = audit.risk_focus_areas
    run.snapshot_target_system_name = audit.target_system_name
    run.snapshot_environment = audit.environment


def _latest_run_for_audit(db: Session, *, audit_id: UUID) -> AuditRun | None:
    return db.scalar(
        select(AuditRun)
        .where(AuditRun.audit_id == audit_id)
        .order_by(desc(AuditRun.created_at), desc(AuditRun.id))
    )


def _find_stage(db: Session, *, run_id: UUID, stage_key: str) -> AuditStage:
    stage = db.scalar(
        select(AuditStage).where(AuditStage.audit_run_id == run_id, AuditStage.stage_key == stage_key)
    )
    if stage is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")
    return stage


def _ordered_stages(db: Session, *, run_id: UUID) -> list[AuditStage]:
    return list(
        db.scalars(
            select(AuditStage).where(AuditStage.audit_run_id == run_id).order_by(AuditStage.stage_order.asc())
        ).all()
    )


def _findings_summary(db: Session, *, run_id: UUID) -> FindingsSummaryRead:
    findings = db.scalars(
        select(AuditFinding).where(AuditFinding.audit_run_id == run_id, AuditFinding.is_stale.is_(False))
    ).all()
    severity_counts: dict[str, int] = {level.value: 0 for level in AuditSeverity}
    for finding in findings:
        severity_counts[finding.severity] = severity_counts.get(finding.severity, 0) + 1

    return FindingsSummaryRead(
        total=len(findings),
        validated=sum(1 for item in findings if item.is_validated),
        critical_open=sum(1 for item in findings if item.severity == AuditSeverity.CRITICAL.value and item.status == AuditFindingStatus.OPEN.value),
        blocking_open=sum(1 for item in findings if item.certification_blocking and item.status == AuditFindingStatus.OPEN.value),
        severity_counts=severity_counts,
    )


def _risk_score_from_findings(findings: list[AuditFinding]) -> float:
    score = 100.0
    for finding in findings:
        if finding.is_stale:
            continue
        if finding.severity == AuditSeverity.CRITICAL.value:
            score -= 24
        elif finding.severity == AuditSeverity.HIGH.value:
            score -= 12
        elif finding.severity == AuditSeverity.MEDIUM.value:
            score -= 6
        else:
            score -= 2
    return max(0.0, min(100.0, score))


def create_audit_with_initial_run(
    db: Session,
    *,
    organization_id: UUID,
    payload: AuditCreateRequest,
) -> tuple[Audit, AuditRun, list[AuditStage]]:
    validate_audit_project_linkage(db, organization_id=organization_id, project_id=payload.project_id)

    audit = Audit(
        organization_id=organization_id,
        name=payload.name,
        target_system_name=payload.target_system_name,
        company_name=payload.company_name,
        audit_type=payload.audit_type.value,
        policy_profile=_resolve_policy_profile(payload),
        description=payload.description,
        use_cases=payload.use_cases,
        workflow_summary=payload.workflow_summary,
        endpoints_notes=payload.endpoints_notes,
        risk_focus_areas=payload.risk_focus_areas,
        status=AuditStatus.DRAFT.value,
        project_id=payload.project_id,
        environment=payload.environment,
        linked_production_enabled=payload.linked_production_enabled,
        evidence_window_days=payload.evidence_window_days,
        include_incidents=payload.include_incidents,
        include_trace_samples=payload.include_trace_samples,
        include_guardrail_violations=payload.include_guardrail_violations,
        include_regressions=payload.include_regressions,
        include_model_changes=payload.include_model_changes,
    )
    db.add(audit)
    db.flush()

    run = AuditRun(
        audit_id=audit.id,
        organization_id=organization_id,
        status=AuditRunStatus.QUEUED.value,
        current_stage_key=AuditStageKey.SCOPING.value,
        certification_status=CertificationStatus.PENDING.value,
    )
    _snapshot_run_inputs(run, audit)
    db.add(run)
    db.flush()

    stages = _seed_run_stages(db, run=run)
    db.commit()
    db.refresh(audit)
    db.refresh(run)
    for stage in stages:
        db.refresh(stage)
    return audit, run, stages


def list_audits(db: Session, *, organization_id: UUID, status_filter: str | None = None, audit_type: str | None = None, search: str | None = None, project_id: UUID | None = None) -> AuditListResponse:
    statement = select(Audit).where(Audit.organization_id == organization_id)
    if status_filter:
        statement = statement.where(Audit.status == status_filter)
    if audit_type:
        statement = statement.where(Audit.audit_type == audit_type)
    if search:
        statement = statement.where(func.lower(Audit.name).like(f"%{search.lower()}%"))
    if project_id:
        statement = statement.where(Audit.project_id == project_id)

    audits = list(db.scalars(statement.order_by(desc(Audit.updated_at), desc(Audit.created_at))).all())
    items: list[AuditListItemRead] = []
    for audit in audits:
        latest_run = _latest_run_for_audit(db, audit_id=audit.id)
        stages: list[AuditStage] = []
        if latest_run is not None:
            stages = _ordered_stages(db, run_id=latest_run.id)
        items.append(
            AuditListItemRead(
                audit=audit,
                latest_run=latest_run,
                latest_run_stages=stages,
            )
        )
    return AuditListResponse(items=items)


def get_audit(db: Session, *, organization_id: UUID, audit_id: UUID) -> Audit:
    audit = db.get(Audit, audit_id)
    if audit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    if audit.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return audit


def get_audit_detail(db: Session, *, organization_id: UUID, audit_id: UUID) -> AuditDetailResponse:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    latest_run = _latest_run_for_audit(db, audit_id=audit.id)
    stages: list[AuditStage] = []
    findings_summary = FindingsSummaryRead(total=0, validated=0, critical_open=0, blocking_open=0, severity_counts={})
    artifacts: list[AuditArtifact] = []
    linked_context: dict | None = None
    if latest_run is not None:
        stages = _ordered_stages(db, run_id=latest_run.id)
        findings_summary = _findings_summary(db, run_id=latest_run.id)
        artifacts = list(
            db.scalars(
                select(AuditArtifact)
                .where(
                    AuditArtifact.audit_run_id == latest_run.id,
                    AuditArtifact.is_stale.is_(False),
                )
                .order_by(desc(AuditArtifact.created_at))
            ).all()
        )
        linked_context = latest_run.production_snapshot_metadata

    return AuditDetailResponse(
        audit=audit,
        latest_run=latest_run,
        stages=stages,
        findings_summary=findings_summary,
        artifacts=artifacts,
        linked_production_context=linked_context,
    )


def list_audit_runs(db: Session, *, organization_id: UUID, audit_id: UUID) -> AuditRunListResponse:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    runs = list(
        db.scalars(
            select(AuditRun)
            .where(AuditRun.audit_id == audit.id)
            .order_by(desc(AuditRun.created_at), desc(AuditRun.id))
        ).all()
    )
    return AuditRunListResponse(items=runs)


def get_audit_run(db: Session, *, organization_id: UUID, audit_id: UUID, run_id: UUID) -> AuditRun:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    run = db.get(AuditRun, run_id)
    if run is None or run.audit_id != audit.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit run not found")
    if run.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return run


def create_audit_run(db: Session, *, organization_id: UUID, audit_id: UUID) -> tuple[Audit, AuditRun, list[AuditStage]]:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    run = AuditRun(
        audit_id=audit.id,
        organization_id=organization_id,
        status=AuditRunStatus.QUEUED.value,
        current_stage_key=AuditStageKey.SCOPING.value,
        certification_status=CertificationStatus.PENDING.value,
    )
    _snapshot_run_inputs(run, audit)
    db.add(run)
    db.flush()
    stages = _seed_run_stages(db, run=run)
    db.commit()
    db.refresh(audit)
    db.refresh(run)
    for stage in stages:
        db.refresh(stage)
    return audit, run, stages


def _persist_stage_execution(
    db: Session,
    *,
    run: AuditRun,
    stage: AuditStage,
    executor: AuditStageExecutor,
    context: dict,
) -> AuditStage:
    stage.status = AuditStageStatus.RUNNING.value
    stage.started_at = _utc_now()
    run.status = AuditRunStatus.RUNNING.value
    run.current_stage_key = stage.stage_key
    db.flush()

    result = executor.execute_stage(run_id=run.id, stage_key=stage.stage_key, context=context)

    stage.status = AuditStageStatus.COMPLETED.value
    stage.completed_at = _utc_now()
    stage.summary = result.summary
    stage.output_metadata = result.output_metadata

    for finding in result.findings:
        fingerprint = sha1(f"{run.id}:{stage.stage_key}:{finding.title}:{finding.category}".encode("utf-8")).hexdigest()
        db.add(
            AuditFinding(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                title=finding.title,
                category=finding.category,
                severity=finding.severity,
                summary=finding.summary,
                evidence=finding.evidence,
                repro_steps=finding.repro_steps,
                confidence=finding.confidence,
                status=AuditFindingStatus.OPEN.value,
                origin_source="audit_test",
                source_stage_key=stage.stage_key,
                evidence_type=finding.evidence_type,
                evidence_ref=finding.evidence_ref,
                finding_fingerprint=fingerprint,
                is_validated=stage.stage_key in {AuditStageKey.VALIDATION.value, AuditStageKey.REVIEW.value, AuditStageKey.CERTIFICATION.value},
                validated_at=_utc_now() if stage.stage_key in {AuditStageKey.VALIDATION.value, AuditStageKey.REVIEW.value, AuditStageKey.CERTIFICATION.value} else None,
                monitoring_recommended=finding.recommendation_type is not None,
                certification_blocking=finding.severity in {AuditSeverity.CRITICAL.value, AuditSeverity.HIGH.value},
                recommended_monitor_type=finding.recommendation_type,
                recommended_scope=finding.recommendation_scope,
                recommended_threshold_hint=finding.recommendation_threshold_hint,
                is_stale=False,
            )
        )

    for artifact in result.artifacts:
        db.add(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type=artifact.artifact_type,
                title=artifact.title,
                storage_ref=artifact.storage_ref,
                metadata_json={**artifact.metadata_json, "source_stage_key": stage.stage_key},
                is_stale=False,
            )
        )

    if result.risk_score is not None:
        run.risk_score = result.risk_score
    if result.certification_status is not None:
        run.certification_status = result.certification_status
        if result.certification_status in {CertificationStatus.PASS.value, CertificationStatus.CONDITIONAL.value, CertificationStatus.FAIL.value}:
            run.certification_effective_at = _utc_now()
    if result.run_status is not None:
        run.status = result.run_status

    db.flush()
    return stage


def start_audit_run(
    db: Session,
    *,
    organization_id: UUID,
    audit_id: UUID,
    run_id: UUID,
    executor: AuditStageExecutor | None = None,
) -> tuple[Audit, AuditRun, list[AuditStage]]:
    run = get_audit_run(db, organization_id=organization_id, audit_id=audit_id, run_id=run_id)
    audit = run.audit
    if run.started_at is None:
        run.started_at = _utc_now()

    capture_production_evidence_snapshot(db, audit=audit, run=run)

    stages = _ordered_stages(db, run_id=run.id)
    if not stages:
        stages = _seed_run_stages(db, run=run)

    first_stage = stages[0]
    executor_impl = executor or _default_executor()
    _persist_stage_execution(
        db,
        run=run,
        stage=first_stage,
        executor=executor_impl,
        context={
            "audit_type": audit.audit_type,
            "policy_profile": audit.policy_profile,
            "target_system_name": run.snapshot_target_system_name,
            "production_snapshot_metadata": run.production_snapshot_metadata,
        },
    )

    if len(stages) > 1 and stages[1].status == AuditStageStatus.NOT_STARTED.value:
        stages[1].status = AuditStageStatus.QUEUED.value

    run.status = AuditRunStatus.RUNNING.value
    run.current_stage_key = first_stage.stage_key
    audit.status = AuditStatus.ACTIVE.value

    db.flush()
    db.commit()
    db.refresh(audit)
    db.refresh(run)
    refreshed = _ordered_stages(db, run_id=run.id)
    return audit, run, refreshed


def _mark_downstream_stale(db: Session, *, run_id: UUID, stage_order: int) -> None:
    downstream_stage_keys = [
        item.stage_key
        for item in db.scalars(
            select(AuditStage).where(
                AuditStage.audit_run_id == run_id,
                AuditStage.stage_order > stage_order,
            )
        ).all()
    ]

    if downstream_stage_keys:
        downstream_set = set(downstream_stage_keys)
        for finding in db.scalars(
            select(AuditFinding).where(
                AuditFinding.audit_run_id == run_id,
                AuditFinding.source_stage_key.in_(downstream_stage_keys),
            )
        ).all():
            finding.is_stale = True

        for artifact in db.scalars(
            select(AuditArtifact).where(AuditArtifact.audit_run_id == run_id)
        ).all():
            source_stage_key = _artifact_source_stage_key(artifact)
            is_downstream_stage_artifact = source_stage_key in downstream_set
            if artifact.artifact_type in {"executive_report", "certification_report", "evidence_bundle"} or is_downstream_stage_artifact:
                artifact.is_stale = True


def rerun_audit_stage(
    db: Session,
    *,
    organization_id: UUID,
    audit_id: UUID,
    run_id: UUID,
    stage_key: str,
    executor: AuditStageExecutor | None = None,
) -> tuple[Audit, AuditRun, list[AuditStage]]:
    run = get_audit_run(db, organization_id=organization_id, audit_id=audit_id, run_id=run_id)
    audit = run.audit
    stage = _find_stage(db, run_id=run.id, stage_key=stage_key)
    stages = _ordered_stages(db, run_id=run.id)

    for item in stages:
        if item.stage_order > stage.stage_order:
            item.status = AuditStageStatus.NOT_STARTED.value
            item.started_at = None
            item.completed_at = None
            item.summary = None
            item.output_metadata = None

    _mark_downstream_stale(db, run_id=run.id, stage_order=stage.stage_order)

    stage.status = AuditStageStatus.QUEUED.value
    stage.started_at = None
    stage.completed_at = None

    run.status = AuditRunStatus.RUNNING.value
    run.current_stage_key = stage.stage_key
    run.certification_status = CertificationStatus.PENDING.value
    run.certification_effective_at = None
    run.completed_at = None

    summary = db.scalar(
        select(ProjectAuditSummary).where(
            ProjectAuditSummary.organization_id == organization_id,
            ProjectAuditSummary.latest_audit_run_id == run.id,
        )
    )
    if summary is not None:
        summary.certification_status = CertificationStatus.PENDING.value
        summary.latest_audit_completed_at = None

    executor_impl = executor or _default_executor()
    _persist_stage_execution(
        db,
        run=run,
        stage=stage,
        executor=executor_impl,
        context={
            "audit_type": audit.audit_type,
            "policy_profile": audit.policy_profile,
            "target_system_name": run.snapshot_target_system_name,
            "production_snapshot_metadata": run.production_snapshot_metadata,
        },
    )

    # Ensure next stage is ready and results remain pending until downstream completion.
    next_stage = next((item for item in stages if item.stage_order == stage.stage_order + 1), None)
    if next_stage is not None:
        next_stage.status = AuditStageStatus.QUEUED.value
    run.certification_status = CertificationStatus.PENDING.value
    run.status = AuditRunStatus.RUNNING.value

    db.commit()
    db.refresh(audit)
    db.refresh(run)
    refreshed = _ordered_stages(db, run_id=run.id)
    return audit, run, refreshed


def continue_audit_review(
    db: Session,
    *,
    organization_id: UUID,
    audit_id: UUID,
    run_id: UUID,
    executor: AuditStageExecutor | None = None,
) -> tuple[Audit, AuditRun, list[AuditStage]]:
    run = get_audit_run(db, organization_id=organization_id, audit_id=audit_id, run_id=run_id)
    audit = run.audit
    stages = _ordered_stages(db, run_id=run.id)
    executor_impl = executor or _default_executor()

    for stage in stages:
        if stage.status in {AuditStageStatus.NOT_STARTED.value, AuditStageStatus.QUEUED.value}:
            _persist_stage_execution(
                db,
                run=run,
                stage=stage,
                executor=executor_impl,
                context={
                    "audit_type": audit.audit_type,
                    "policy_profile": audit.policy_profile,
                    "target_system_name": run.snapshot_target_system_name,
                    "production_snapshot_metadata": run.production_snapshot_metadata,
                },
            )
            if stage.stage_key == AuditStageKey.REVIEW.value:
                run.status = AuditRunStatus.NEEDS_REVIEW.value

    all_completed = all(stage.status == AuditStageStatus.COMPLETED.value for stage in stages)
    findings = list(db.scalars(select(AuditFinding).where(AuditFinding.audit_run_id == run.id)).all())
    if run.risk_score is None:
        run.risk_score = _risk_score_from_findings(findings)

    if all_completed:
        run.status = AuditRunStatus.COMPLETED.value
        run.completed_at = _utc_now()
        if run.certification_status == CertificationStatus.PENDING.value:
            has_critical = any(
                item.severity == AuditSeverity.CRITICAL.value and item.status == AuditFindingStatus.OPEN.value and not item.is_stale
                for item in findings
            )
            has_high = any(
                item.severity == AuditSeverity.HIGH.value and item.status == AuditFindingStatus.OPEN.value and not item.is_stale
                for item in findings
            )
            run.certification_status = (
                CertificationStatus.FAIL.value
                if has_critical
                else CertificationStatus.CONDITIONAL.value
                if has_high
                else CertificationStatus.PASS.value
            )
        if run.certification_effective_at is None:
            run.certification_effective_at = _utc_now()
        audit.status = AuditStatus.COMPLETED.value

        # Produce summary artifacts.
        non_stale_findings = [item for item in findings if not item.is_stale]
        blocking_findings = [
            item
            for item in non_stale_findings
            if item.certification_blocking and item.status == AuditFindingStatus.OPEN.value
        ]
        report_recommendations = [_recommendation_from_finding(item) for item in blocking_findings[:3]]
        db.add(
            AuditArtifact(
                audit_run_id=run.id,
                organization_id=run.organization_id,
                artifact_type="evidence_bundle",
                title="Evidence Bundle",
                storage_ref=None,
                metadata_json={
                    "generated_at": _utc_now().isoformat(),
                    "finding_count": len(non_stale_findings),
                    "blocking_count": len(blocking_findings),
                    "top_evidence_refs": [item.evidence_ref for item in non_stale_findings if item.evidence_ref][:5],
                    "recommendations": report_recommendations,
                },
                is_stale=False,
            )
        )

    upsert_project_audit_summary(db, run=run)
    db.commit()
    db.refresh(audit)
    db.refresh(run)
    refreshed = _ordered_stages(db, run_id=run.id)
    return audit, run, refreshed


def _build_results(db: Session, *, audit: Audit, run: AuditRun) -> AuditResultsRead:
    stages = _ordered_stages(db, run_id=run.id)
    findings = list(
        db.scalars(
            select(AuditFinding)
            .where(AuditFinding.audit_run_id == run.id, AuditFinding.is_stale.is_(False))
            .order_by(desc(AuditFinding.created_at))
        ).all()
    )
    artifacts = list(
        db.scalars(
            select(AuditArtifact)
            .where(
                AuditArtifact.audit_run_id == run.id,
                AuditArtifact.is_stale.is_(False),
            )
            .order_by(desc(AuditArtifact.created_at))
        ).all()
    )
    findings_summary = _findings_summary(db, run_id=run.id)

    top_risks = [item.title for item in findings if item.severity in {AuditSeverity.CRITICAL.value, AuditSeverity.HIGH.value}][:3]
    blocking_findings = [
        item
        for item in findings
        if item.certification_blocking and item.status == AuditFindingStatus.OPEN.value
    ]
    if blocking_findings:
        recommended_actions = [_recommendation_from_finding(item) for item in blocking_findings[:3]]
        recommended_actions.append("Re-run certification after blocker remediation is complete.")
    else:
        recommended_actions = [
            "Maintain current controls and monitor validated risk surfaces.",
            "Apply suggested monitoring recommendations to protect certification posture.",
            "Run a scheduled follow-up audit to confirm reliability trend stability.",
        ]
    if run.status == AuditRunStatus.COMPLETED.value and run.certification_status != CertificationStatus.PENDING.value:
        summary = (
            "Audit run completed with reproducible findings and evidence-backed risk scoring. "
            "Certification reflects current production-readiness posture and remediation priorities."
        )
    else:
        summary = (
            "Audit run is in progress or has been invalidated by a rerun. "
            "Certification is pending until downstream stages complete."
        )

    return AuditResultsRead(
        audit=audit,
        run=run,
        stages=stages,
        findings=findings,
        findings_summary=findings_summary,
        artifacts=artifacts,
        top_risks=top_risks,
        summary=summary,
        recommended_actions=recommended_actions,
        monitoring_recommendations=derive_monitoring_recommendations(db, run_id=run.id),
    )


def get_run_results(db: Session, *, organization_id: UUID, audit_id: UUID, run_id: UUID) -> AuditResultsRead:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    run = get_audit_run(db, organization_id=organization_id, audit_id=audit.id, run_id=run_id)
    return _build_results(db, audit=audit, run=run)


def get_latest_results(db: Session, *, organization_id: UUID, audit_id: UUID) -> AuditResultsRead:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    run = _latest_run_for_audit(db, audit_id=audit.id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No audit runs found")
    return _build_results(db, audit=audit, run=run)


def get_latest_run(db: Session, *, organization_id: UUID, audit_id: UUID) -> AuditRunRead | None:
    audit = get_audit(db, organization_id=organization_id, audit_id=audit_id)
    run = _latest_run_for_audit(db, audit_id=audit.id)
    return AuditRunRead.model_validate(run) if run is not None else None
