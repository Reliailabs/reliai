from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.deployment import Deployment
from app.models.deployment_event import DeploymentEvent
from app.models.deployment_rollback import DeploymentRollback
from app.models.environment import Environment
from app.models.external_processor import ExternalProcessor
from app.models.guardrail_policy import GuardrailPolicy
from app.models.project import Project
from app.models.reliability_action_log import ReliabilityActionLog
from app.models.trace_ingestion_policy import TraceIngestionPolicy
from app.services.environments import get_default_environment

ACTION_STATUS_SUCCESS = "success"
ACTION_STATUS_DRY_RUN = "dry_run"
ACTION_STATUS_SKIPPED_COOLDOWN = "skipped_cooldown"
ACTION_STATUS_SKIPPED_FREQUENCY = "skipped_frequency"
ACTION_STATUS_ERROR = "error"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _project_or_404(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _default_environment(db: Session, project: Project) -> Environment:
    environment = db.scalar(
        select(Environment)
        .where(Environment.project_id == project.id)
        .order_by(Environment.created_at.asc(), Environment.id.asc())
    )
    if environment is not None:
        return environment
    return get_default_environment(db, project_id=project.id)


def _default_guardrail_config(policy_type: str) -> dict:
    if policy_type == "structured_output":
        return {"action": "retry", "require_json": True}
    if policy_type == "hallucination":
        return {"action": "retry", "require_retrieval": True}
    if policy_type == "latency_retry":
        return {"action": "retry", "max_latency_ms": 2000}
    return {"action": "retry"}


def log_reliability_action(
    db: Session,
    *,
    project_id: UUID,
    action_type: str,
    target: str,
    status: str,
    rule_id: UUID | None = None,
    detail_json: dict | None = None,
) -> ReliabilityActionLog:
    log = ReliabilityActionLog(
        project_id=project_id,
        rule_id=rule_id,
        action_type=action_type,
        target=target,
        status=status,
        detail_json=detail_json,
    )
    db.add(log)
    db.flush()
    return log


def rollback_deployment(
    db: Session,
    *,
    project_id: UUID,
    deployment_id: UUID,
    rule_id: UUID | None = None,
    dry_run: bool = False,
    rollback_reason: str = "Automated reliability rollback",
) -> ReliabilityActionLog:
    deployment = db.get(Deployment, deployment_id)
    if deployment is None or deployment.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    target = f"deployment:{deployment.id}"
    if dry_run:
        return log_reliability_action(
            db,
            project_id=project_id,
            rule_id=rule_id,
            action_type="rollback_deployment",
            target=target,
            status=ACTION_STATUS_DRY_RUN,
            detail_json={"rollback_reason": rollback_reason},
        )

    db.add(
        DeploymentRollback(
            deployment_id=deployment.id,
            rollback_reason=rollback_reason,
            rolled_back_at=_utc_now(),
        )
    )
    db.add(
        DeploymentEvent(
            deployment_id=deployment.id,
            event_type="rollback_completed",
            metadata_json={"rollback_reason": rollback_reason, "source": "automation_rule", "rule_id": str(rule_id) if rule_id else None},
        )
    )
    return log_reliability_action(
        db,
        project_id=project_id,
        rule_id=rule_id,
        action_type="rollback_deployment",
        target=target,
        status=ACTION_STATUS_SUCCESS,
        detail_json={"rollback_reason": rollback_reason},
    )


def enable_guardrail(
    db: Session,
    *,
    project_id: UUID,
    policy_type: str,
    rule_id: UUID | None = None,
    dry_run: bool = False,
) -> ReliabilityActionLog:
    project = _project_or_404(db, project_id)
    policy = db.scalar(
        select(GuardrailPolicy)
        .where(GuardrailPolicy.project_id == project_id, GuardrailPolicy.policy_type == policy_type)
        .order_by(desc(GuardrailPolicy.created_at), desc(GuardrailPolicy.id))
    )
    target = f"guardrail:{policy_type}"
    if dry_run:
        return log_reliability_action(
            db,
            project_id=project_id,
            rule_id=rule_id,
            action_type="enable_guardrail",
            target=target,
            status=ACTION_STATUS_DRY_RUN,
            detail_json={"existing_policy_id": str(policy.id) if policy is not None else None},
        )

    if policy is None:
        environment = _default_environment(db, project)
        policy = GuardrailPolicy(
            project_id=project.id,
            environment_id=environment.id,
            policy_type=policy_type,
            config_json=_default_guardrail_config(policy_type),
            is_active=True,
        )
        db.add(policy)
        db.flush()
    else:
        policy.is_active = True

    return log_reliability_action(
        db,
        project_id=project_id,
        rule_id=rule_id,
        action_type="enable_guardrail",
        target=target,
        status=ACTION_STATUS_SUCCESS,
        detail_json={"policy_id": str(policy.id)},
    )


def increase_sampling(
    db: Session,
    *,
    project_id: UUID,
    rule_id: UUID | None = None,
    dry_run: bool = False,
) -> ReliabilityActionLog:
    _project_or_404(db, project_id)
    policy = db.scalar(
        select(TraceIngestionPolicy).where(
            TraceIngestionPolicy.project_id == project_id,
            TraceIngestionPolicy.environment_id.is_(None),
        )
    )
    target = f"trace_ingestion_policy:{project_id}"
    if dry_run:
        return log_reliability_action(
            db,
            project_id=project_id,
            rule_id=rule_id,
            action_type="increase_sampling",
            target=target,
            status=ACTION_STATUS_DRY_RUN,
            detail_json={
                "sampling_success_rate": float(policy.sampling_success_rate) if policy is not None else 1.0,
                "sampling_error_rate": float(policy.sampling_error_rate) if policy is not None else 1.0,
            },
        )

    if policy is None:
        policy = TraceIngestionPolicy(project_id=project_id, environment_id=None)
        db.add(policy)
        db.flush()
    policy.sampling_success_rate = min(1.0, float(policy.sampling_success_rate) + 0.25)
    policy.sampling_error_rate = min(1.0, float(policy.sampling_error_rate) + 0.25)

    return log_reliability_action(
        db,
        project_id=project_id,
        rule_id=rule_id,
        action_type="increase_sampling",
        target=target,
        status=ACTION_STATUS_SUCCESS,
        detail_json={
            "sampling_success_rate": float(policy.sampling_success_rate),
            "sampling_error_rate": float(policy.sampling_error_rate),
        },
    )


def disable_processor(
    db: Session,
    *,
    project_id: UUID,
    processor_id: UUID,
    rule_id: UUID | None = None,
    dry_run: bool = False,
) -> ReliabilityActionLog:
    processor = db.get(ExternalProcessor, processor_id)
    if processor is None or processor.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processor not found")
    target = f"processor:{processor.id}"
    if dry_run:
        return log_reliability_action(
            db,
            project_id=project_id,
            rule_id=rule_id,
            action_type="disable_processor",
            target=target,
            status=ACTION_STATUS_DRY_RUN,
            detail_json={"enabled": processor.enabled},
        )

    processor.enabled = False
    return log_reliability_action(
        db,
        project_id=project_id,
        rule_id=rule_id,
        action_type="disable_processor",
        target=target,
        status=ACTION_STATUS_SUCCESS,
        detail_json={"processor_name": processor.name},
    )


def list_project_reliability_actions(
    db: Session,
    *,
    project_id: UUID,
    limit: int = 25,
) -> list[ReliabilityActionLog]:
    return list(
        db.scalars(
            select(ReliabilityActionLog)
            .where(ReliabilityActionLog.project_id == project_id)
            .order_by(desc(ReliabilityActionLog.created_at), desc(ReliabilityActionLog.id))
            .limit(limit)
        ).all()
    )
