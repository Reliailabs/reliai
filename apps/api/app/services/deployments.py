from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_event import DeploymentEvent
from app.models.model_version import ModelVersion
from app.models.project import Project
from app.models.prompt_version import PromptVersion
from app.services.audit_log import log_action
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.deployment_gate import evaluate_deployment
from app.services.deployment_risk_engine import get_deployment_risk_score
from app.services.environments import normalize_environment_name, resolve_project_environment
from app.services.event_stream import DeploymentCreatedEventPayload, publish_event
from app.services.global_reliability_patterns import get_global_reliability_patterns
from app.services.reliability_graph import (
    get_graph_guardrail_recommendations,
    get_high_risk_patterns,
    get_model_failure_graph,
)
from app.workers.deployment_risk_analysis import enqueue_deployment_risk_analysis
from app.core.settings import get_settings

DEPLOYMENT_EVENT_CREATED = "created"


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _validate_registry_scope(
    db: Session,
    *,
    project_id: UUID,
    prompt_version_id: UUID | None,
    model_version_id: UUID | None,
) -> tuple[PromptVersion | None, ModelVersion | None]:
    prompt_version = None
    model_version = None
    if prompt_version_id is not None:
        prompt_version = db.get(PromptVersion, prompt_version_id)
        if prompt_version is None or prompt_version.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt version does not belong to project",
            )
    if model_version_id is not None:
        model_version = db.get(ModelVersion, model_version_id)
        if model_version is None or model_version.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Model version does not belong to project",
            )
    return prompt_version, model_version


def create_deployment(
    db: Session,
    *,
    project_id: UUID,
    payload,
    actor_user_id: UUID | None = None,
) -> Deployment:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    prompt_version, model_version = _validate_registry_scope(
        db,
        project_id=project_id,
        prompt_version_id=payload.prompt_version_id,
        model_version_id=payload.model_version_id,
    )
    environment = resolve_project_environment(db, project=project, name=payload.environment)
    deployment = Deployment(
        project_id=project_id,
        environment_id=environment.id,
        prompt_version_id=prompt_version.id if prompt_version is not None else None,
        model_version_id=model_version.id if model_version is not None else None,
        environment=environment.name,
        deployed_by=payload.deployed_by,
        deployed_at=_as_utc(payload.deployed_at),
        metadata_json=payload.metadata_json,
    )
    db.add(deployment)
    db.flush()
    db.add(
        DeploymentEvent(
            deployment_id=deployment.id,
            event_type=DEPLOYMENT_EVENT_CREATED,
            metadata_json={
                "prompt_version_id": str(prompt_version.id) if prompt_version is not None else None,
                "model_version_id": str(model_version.id) if model_version is not None else None,
                "environment": deployment.environment,
                "deployed_by": deployment.deployed_by,
            },
            created_at=deployment.deployed_at,
        )
    )
    if actor_user_id is not None:
        log_action(
            db,
            organization_id=project.organization_id,
            user_id=actor_user_id,
            action="deployment_created",
            resource_type="deployment",
            resource_id=deployment.id,
            metadata={
                "project_id": str(project.id),
                "environment": deployment.environment,
                "prompt_version_id": str(prompt_version.id) if prompt_version is not None else None,
                "model_version_id": str(model_version.id) if model_version is not None else None,
            },
        )
    db.commit()
    publish_event(
        get_settings().event_stream_topic_traces,
        DeploymentCreatedEventPayload(
            project_id=str(deployment.project_id),
            environment_id=str(deployment.environment_id),
            deployment_id=str(deployment.id),
            deployed_at=deployment.deployed_at,
            environment=deployment.environment,
            deployed_by=deployment.deployed_by,
            prompt_version_id=str(prompt_version.id) if prompt_version is not None else None,
            model_version_id=str(model_version.id) if model_version is not None else None,
            metadata=deployment.metadata_json or {},
        ).model_dump(mode="json"),
    )
    enqueue_deployment_risk_analysis(deployment_id=deployment.id)
    return get_deployment_by_id(db, deployment_id=deployment.id)  # type: ignore[return-value]


def list_project_deployments(db: Session, *, project_id: UUID, environment: str | None = None) -> list[Deployment]:
    statement = select(Deployment).where(Deployment.project_id == project_id)
    if environment is not None:
        statement = statement.where(Deployment.environment == normalize_environment_name(environment))
    return db.scalars(
        statement
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
    ).all()


def get_deployment_by_id(db: Session, *, deployment_id: UUID) -> Deployment | None:
    return db.scalar(
        select(Deployment)
        .options(
            selectinload(Deployment.project),
            selectinload(Deployment.prompt_version),
            selectinload(Deployment.model_version),
            selectinload(Deployment.events),
            selectinload(Deployment.rollbacks),
            selectinload(Deployment.incidents),
            selectinload(Deployment.risk_score),
        )
        .where(Deployment.id == deployment_id)
    )


def get_deployment_detail(db: Session, *, operator: OperatorContext, deployment_id: UUID) -> Deployment:
    deployment = get_deployment_by_id(db, deployment_id=deployment_id)
    if deployment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    require_project_access(db, operator, deployment.project_id)
    return deployment


def get_deployment_detail_with_risk(db: Session, *, operator: OperatorContext, deployment_id: UUID) -> Deployment:
    deployment = get_deployment_detail(db, operator=operator, deployment_id=deployment_id)
    if deployment.risk_score is None:
        return deployment
    deployment.risk_score = get_deployment_risk_score(db, deployment_id=deployment.id)
    return deployment


def get_deployment_intelligence(
    db: Session,
    *,
    operator: OperatorContext,
    deployment_id: UUID,
) -> dict:
    deployment = get_deployment_detail_with_risk(db, operator=operator, deployment_id=deployment_id)
    organization_ids = operator.organization_ids or [deployment.project.organization_id]
    model_family = deployment.model_version.model_name if deployment.model_version is not None else None
    risk_score = deployment.risk_score.risk_score if deployment.risk_score is not None else None
    analysis_json = deployment.risk_score.analysis_json if deployment.risk_score is not None else {}
    project_patterns = get_high_risk_patterns(
        db,
        organization_ids=organization_ids,
        project_id=deployment.project_id,
        limit=6,
    )
    if project_patterns:
        graph_patterns = project_patterns[:3]
    else:
        graph_patterns = [
            {
                "pattern": item["pattern"],
                "risk": item["risk_level"],
                "trace_count": item["trace_count"],
            }
            for item in get_global_reliability_patterns(db)[:3]
        ]
    recommendations = get_graph_guardrail_recommendations(
        db,
        organization_ids=organization_ids,
        project_id=deployment.project_id,
    )
    model_failure_signals = get_model_failure_graph(
        db,
        model_family=model_family,
        organization_ids=organization_ids,
        project_id=deployment.project_id,
    )
    risk_explanations = list(analysis_json.get("deployment_risk_explanations") or [])
    if not risk_explanations:
        risk_explanations = [
            f"{item['pattern']} detected"
            for item in model_failure_signals.get("patterns", [])[:2]
            if item.get("pattern")
        ]
    return {
        "deployment_id": deployment.id,
        "risk_score": risk_score,
        "risk_explanations": risk_explanations,
        "graph_risk_patterns": [
            {
                "pattern": str(item["pattern"]),
                "risk": str(item.get("risk") or item.get("risk_level") or "medium"),
                "trace_count": int(item.get("trace_count") or item.get("traces") or 0),
            }
            for item in graph_patterns
        ],
        "recommended_guardrails": [str(item["policy_type"]) for item in recommendations],
    }


def get_deployment_gate_result(
    db: Session,
    *,
    operator: OperatorContext,
    deployment_id: UUID,
) -> dict:
    deployment = get_deployment_detail(db, operator=operator, deployment_id=deployment_id)
    return evaluate_deployment(db, deployment.project_id, deployment.id)


def most_recent_project_deployment(
    db: Session,
    *,
    project_id: UUID,
    detected_at: datetime,
) -> Deployment | None:
    return db.scalar(
        select(Deployment)
        .where(
            Deployment.project_id == project_id,
            Deployment.deployed_at <= _as_utc(detected_at),
        )
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
    )
