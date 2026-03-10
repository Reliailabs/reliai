from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.deployment import Deployment
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.deployment_simulation import DeploymentSimulation
from app.models.environment import (
    ENVIRONMENT_DEVELOPMENT,
    ENVIRONMENT_PRODUCTION,
    ENVIRONMENT_STAGING,
    Environment,
)
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.project import Project
from app.models.trace import Trace
from app.services.audit_log import log_action

LEGACY_ENVIRONMENT_NAME_MAP = {
    "prod": ENVIRONMENT_PRODUCTION,
    "production": ENVIRONMENT_PRODUCTION,
    "staging": ENVIRONMENT_STAGING,
    "stage": ENVIRONMENT_STAGING,
    "dev": ENVIRONMENT_DEVELOPMENT,
    "development": ENVIRONMENT_DEVELOPMENT,
}


def normalize_environment_name(name: str | None) -> str:
    normalized = (name or ENVIRONMENT_PRODUCTION).strip().lower()
    return LEGACY_ENVIRONMENT_NAME_MAP.get(normalized, normalized)


def environment_type_for_name(name: str) -> str:
    normalized = normalize_environment_name(name)
    if normalized == ENVIRONMENT_STAGING:
        return ENVIRONMENT_STAGING
    if normalized == ENVIRONMENT_DEVELOPMENT:
        return ENVIRONMENT_DEVELOPMENT
    return ENVIRONMENT_PRODUCTION


def list_project_environments(db: Session, *, project_id: UUID) -> list[Environment]:
    return list(
        db.scalars(
            select(Environment)
            .where(Environment.project_id == project_id)
            .order_by(Environment.created_at.asc(), Environment.name.asc())
        ).all()
    )


def get_environment_by_id(db: Session, *, project_id: UUID, environment_id: UUID) -> Environment | None:
    return db.scalar(
        select(Environment).where(
            Environment.project_id == project_id,
            Environment.id == environment_id,
        )
    )


def get_environment_by_name(db: Session, *, project_id: UUID, name: str) -> Environment | None:
    return db.scalar(
        select(Environment).where(
            Environment.project_id == project_id,
            Environment.name == normalize_environment_name(name),
        )
    )


def get_default_environment(db: Session, *, project_id: UUID) -> Environment:
    environment = get_environment_by_name(db, project_id=project_id, name=ENVIRONMENT_PRODUCTION)
    if environment is not None:
        return environment
    environment = db.scalar(
        select(Environment)
        .where(Environment.project_id == project_id)
        .order_by(Environment.created_at.asc(), Environment.id.asc())
    )
    if environment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")
    return environment


def create_environment(
    db: Session,
    *,
    project: Project,
    name: str,
    environment_type: str | None = None,
    actor_user_id: UUID | None = None,
) -> Environment:
    normalized_name = normalize_environment_name(name)
    environment = Environment(
        project_id=project.id,
        name=normalized_name,
        type=environment_type_for_name(environment_type or normalized_name),
    )
    db.add(environment)
    if actor_user_id is not None:
        log_action(
            db,
            organization_id=project.organization_id,
            user_id=actor_user_id,
            action="environment_created",
            resource_type="environment",
            resource_id=environment.id,
            metadata={
                "project_id": str(project.id),
                "name": environment.name,
                "type": environment.type,
            },
        )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Environment name already exists for project",
        ) from exc
    db.refresh(environment)
    return environment


def ensure_project_environment(db: Session, *, project: Project, name: str) -> Environment:
    existing = get_environment_by_name(db, project_id=project.id, name=name)
    if existing is not None:
        return existing
    environment = Environment(
        project_id=project.id,
        name=normalize_environment_name(name),
        type=environment_type_for_name(name),
    )
    db.add(environment)
    db.flush()
    return environment


def resolve_project_environment(
    db: Session,
    *,
    project: Project,
    name: str | None = None,
) -> Environment:
    normalized_name = normalize_environment_name(name)
    environment = get_environment_by_name(db, project_id=project.id, name=normalized_name)
    if environment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")
    return environment


def ensure_project_bootstrap_environments(db: Session, *, project: Project) -> list[Environment]:
    created: list[Environment] = []
    production = get_environment_by_name(db, project_id=project.id, name=ENVIRONMENT_PRODUCTION)
    if production is None:
        production = ensure_project_environment(db, project=project, name=ENVIRONMENT_PRODUCTION)
        created.append(production)
    project_default = normalize_environment_name(project.environment)
    if project_default != ENVIRONMENT_PRODUCTION and get_environment_by_name(db, project_id=project.id, name=project_default) is None:
        created.append(ensure_project_environment(db, project=project, name=project_default))
    return created


def infer_environment_id_for_insert(connection, target) -> UUID | None:
    if getattr(target, "environment_id", None) is not None:
        return target.environment_id

    if isinstance(target, Trace):
        return _project_default_environment_id(connection, target.project_id, fallback_name=target.environment)
    if isinstance(target, Deployment):
        return _project_default_environment_id(connection, target.project_id, fallback_name=target.environment)
    if isinstance(target, GuardrailPolicy):
        return _project_default_environment_id(connection, target.project_id)
    if isinstance(target, GuardrailRuntimeEvent):
        return _policy_environment_id(connection, target.policy_id)
    if isinstance(target, DeploymentSimulation):
        return _project_default_environment_id(connection, target.project_id)
    if isinstance(target, DeploymentRiskScore):
        return _deployment_environment_id(connection, target.deployment_id)
    if isinstance(target, Incident):
        if target.deployment_id is not None:
            environment_id = _deployment_environment_id(connection, target.deployment_id)
            if environment_id is not None:
                return environment_id
        return _project_default_environment_id(connection, target.project_id)
    return None


def _project_default_environment_id(connection, project_id: UUID, fallback_name: str | None = None) -> UUID | None:
    name = normalize_environment_name(fallback_name)
    environment_id = connection.execute(
        select(Environment.id).where(
            Environment.project_id == project_id,
            Environment.name == name,
        )
    ).scalar_one_or_none()
    if environment_id is not None:
        return environment_id
    return connection.execute(
        select(Environment.id)
        .where(Environment.project_id == project_id)
        .order_by(Environment.created_at.asc(), Environment.id.asc())
    ).scalar_one_or_none()


def _policy_environment_id(connection, policy_id: UUID) -> UUID | None:
    return connection.execute(
        select(GuardrailPolicy.environment_id).where(GuardrailPolicy.id == policy_id)
    ).scalar_one_or_none()


def _deployment_environment_id(connection, deployment_id: UUID) -> UUID | None:
    return connection.execute(
        select(Deployment.environment_id).where(Deployment.id == deployment_id)
    ).scalar_one_or_none()
