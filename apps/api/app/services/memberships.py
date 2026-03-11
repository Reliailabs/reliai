from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.services.audit_log import log_action
from app.services.workos_roles import normalize_org_role, normalize_project_role


def list_organization_members(db: Session, *, organization_id: UUID) -> list[OrganizationMember]:
    return list(
        db.scalars(
            select(OrganizationMember)
            .where(OrganizationMember.organization_id == organization_id)
            .order_by(OrganizationMember.created_at.asc(), OrganizationMember.id.asc())
        ).all()
    )


def add_organization_member(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    role: str,
    actor_user_id: UUID,
) -> OrganizationMember:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    membership = OrganizationMember(
        organization_id=organization_id,
        user_id=user_id,
        auth_user_id=str(user_id),
        role=normalize_org_role(role),
    )
    db.add(membership)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists") from exc
    log_action(
        db,
        organization_id=organization_id,
        user_id=actor_user_id,
        action="organization_member_added",
        resource_type="organization_member",
        resource_id=membership.id,
        metadata={"member_user_id": str(user_id), "role": membership.role},
    )
    db.commit()
    db.refresh(membership)
    return membership


def remove_organization_member(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    actor_user_id: UUID,
) -> None:
    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    member_id = membership.id
    db.execute(delete(OrganizationMember).where(OrganizationMember.id == member_id))
    log_action(
        db,
        organization_id=organization_id,
        user_id=actor_user_id,
        action="organization_member_removed",
        resource_type="organization_member",
        resource_id=member_id,
        metadata={"member_user_id": str(user_id)},
    )
    db.commit()


def list_project_members(db: Session, *, project_id: UUID) -> list[ProjectMember]:
    return list(
        db.scalars(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.created_at.asc(), ProjectMember.id.asc())
        ).all()
    )


def add_project_member(
    db: Session,
    *,
    project_id: UUID,
    user_id: UUID,
    role: str,
    actor_user_id: UUID,
) -> ProjectMember:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    project_member = ProjectMember(
        project_id=project_id,
        user_id=user_id,
        role=normalize_project_role(role),
    )
    db.add(project_member)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists") from exc
    log_action(
        db,
        organization_id=project.organization_id,
        user_id=actor_user_id,
        action="project_member_added",
        resource_type="project_member",
        resource_id=project_member.id,
        metadata={"project_id": str(project_id), "member_user_id": str(user_id), "role": project_member.role},
    )
    db.commit()
    db.refresh(project_member)
    return project_member


def remove_project_member(
    db: Session,
    *,
    project_id: UUID,
    user_id: UUID,
    actor_user_id: UUID,
) -> None:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    member_id = membership.id
    db.execute(delete(ProjectMember).where(ProjectMember.id == member_id))
    log_action(
        db,
        organization_id=project.organization_id,
        user_id=actor_user_id,
        action="project_member_removed",
        resource_type="project_member",
        resource_id=member_id,
        metadata={"project_id": str(project_id), "member_user_id": str(user_id)},
    )
    db.commit()
