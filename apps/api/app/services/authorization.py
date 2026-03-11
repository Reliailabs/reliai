from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.environment import Environment
from app.models.project_member import ProjectMember
from app.models.project import Project
from app.models.trace import Trace
from app.services.auth import OperatorContext
from app.services.environments import (
    get_environment_by_id,
    normalize_environment_name,
    resolve_project_environment,
)
from app.services.workos_roles import (
    ORG_ROLE_ADMIN,
    ORG_ROLE_VIEWER,
    normalize_org_role,
    org_role_meets_requirement,
    project_role_meets_requirement,
)


def require_organization_membership(operator: OperatorContext, organization_id: UUID) -> None:
    if organization_id not in operator.organization_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _org_membership_for(operator: OperatorContext, organization_id: UUID):
    return next(
        (item for item in operator.memberships if item.organization_id == organization_id),
        None,
    )


def require_org_role(operator: OperatorContext, organization_id: UUID, minimum_role: str) -> None:
    require_organization_membership(operator, organization_id)
    membership = _org_membership_for(operator, organization_id)
    if membership is None or not org_role_meets_requirement(membership.role, minimum_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _project_membership_map(db: Session, *, project_ids: list[UUID], user_id: UUID) -> tuple[set[UUID], dict[UUID, ProjectMember]]:
    if not project_ids:
        return set(), {}

    memberships = list(
        db.scalars(
            select(ProjectMember)
            .where(ProjectMember.project_id.in_(project_ids))
            .order_by(ProjectMember.created_at.asc(), ProjectMember.id.asc())
        ).all()
    )
    restricted_project_ids = {membership.project_id for membership in memberships}
    by_project = {
        membership.project_id: membership
        for membership in memberships
        if membership.user_id == user_id
    }
    return restricted_project_ids, by_project


def authorized_project_ids(
    db: Session,
    operator: OperatorContext,
    *,
    organization_id: UUID | None = None,
) -> list[UUID]:
    organization_id = organization_id or operator.active_organization_id
    statement = select(Project).where(Project.organization_id.in_(operator.organization_ids))
    if organization_id is not None:
        statement = statement.where(Project.organization_id == organization_id)
    projects = list(db.scalars(statement.order_by(Project.name.asc(), Project.id.asc())).all())
    if not projects:
        return []

    restricted_project_ids, membership_by_project = _project_membership_map(
        db,
        project_ids=[project.id for project in projects],
        user_id=operator.operator.id,
    )

    allowed: list[UUID] = []
    for project in projects:
        org_membership = _org_membership_for(operator, project.organization_id)
        if org_membership is None or not org_role_meets_requirement(org_membership.role, ORG_ROLE_VIEWER):
            continue
        if normalize_org_role(org_membership.role) == ORG_ROLE_ADMIN:
            allowed.append(project.id)
            continue
        if project.id in restricted_project_ids:
            membership = membership_by_project.get(project.id)
            if membership is not None:
                allowed.append(project.id)
            continue
        allowed.append(project.id)
    return allowed


def require_project_access(db: Session, operator: OperatorContext, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project.environment = normalize_environment_name(project.environment)
    require_org_role(operator, project.organization_id, ORG_ROLE_VIEWER)

    restricted_project_ids, membership_by_project = _project_membership_map(
        db,
        project_ids=[project.id],
        user_id=operator.operator.id,
    )
    membership = _org_membership_for(operator, project.organization_id)
    if membership is not None and normalize_org_role(membership.role) == ORG_ROLE_ADMIN:
        return project
    if project.id in restricted_project_ids and project.id not in membership_by_project:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return project


def require_trace_access(db: Session, operator: OperatorContext, trace_id: UUID) -> Trace:
    trace = db.scalar(select(Trace).where(Trace.id == trace_id))
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    require_project_access(db, operator, trace.project_id)
    return trace


def require_system_admin(operator: OperatorContext) -> None:
    if not operator.operator.is_system_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator access required",
        )


def require_org_admin(operator: OperatorContext, organization_id: UUID) -> None:
    require_org_role(operator, organization_id, ORG_ROLE_ADMIN)


def require_project_role(
    db: Session,
    operator: OperatorContext,
    project_id: UUID,
    required_role: str,
) -> Project:
    project = require_project_access(db, operator, project_id)
    org_membership = _org_membership_for(operator, project.organization_id)
    if org_membership is not None and normalize_org_role(org_membership.role) == ORG_ROLE_ADMIN:
        return project

    restricted_project_ids, membership_by_project = _project_membership_map(
        db,
        project_ids=[project.id],
        user_id=operator.operator.id,
    )
    if project.id in restricted_project_ids:
        membership = membership_by_project.get(project.id)
        if membership is None or not project_role_meets_requirement(membership.role, required_role):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return project

    if org_membership is None or not org_role_meets_requirement(org_membership.role, required_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return project


def require_environment_access(
    db: Session,
    operator: OperatorContext,
    project_id: UUID,
    environment_name_or_id: str | UUID,
) -> Environment:
    project = require_project_access(db, operator, project_id)
    if isinstance(environment_name_or_id, UUID):
        environment = get_environment_by_id(db, project_id=project.id, environment_id=environment_name_or_id)
    else:
        try:
            environment_uuid = UUID(str(environment_name_or_id))
        except (TypeError, ValueError):
            environment = resolve_project_environment(
                db,
                project=project,
                name=normalize_environment_name(str(environment_name_or_id)),
            )
        else:
            environment = get_environment_by_id(db, project_id=project.id, environment_id=environment_uuid)
    if environment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")
    return environment
