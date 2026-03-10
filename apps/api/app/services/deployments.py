from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_event import DeploymentEvent
from app.models.model_version import ModelVersion
from app.models.prompt_version import PromptVersion
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.deployment_risk_engine import get_deployment_risk_score
from app.workers.deployment_risk_analysis import enqueue_deployment_risk_analysis

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


def create_deployment(db: Session, *, project_id: UUID, payload) -> Deployment:
    prompt_version, model_version = _validate_registry_scope(
        db,
        project_id=project_id,
        prompt_version_id=payload.prompt_version_id,
        model_version_id=payload.model_version_id,
    )
    deployment = Deployment(
        project_id=project_id,
        prompt_version_id=prompt_version.id if prompt_version is not None else None,
        model_version_id=model_version.id if model_version is not None else None,
        environment=payload.environment,
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
    db.commit()
    enqueue_deployment_risk_analysis(deployment_id=deployment.id)
    return get_deployment_by_id(db, deployment_id=deployment.id)  # type: ignore[return-value]


def list_project_deployments(db: Session, *, project_id: UUID) -> list[Deployment]:
    return db.scalars(
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
    ).all()


def get_deployment_by_id(db: Session, *, deployment_id: UUID) -> Deployment | None:
    return db.scalar(
        select(Deployment)
        .options(
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
