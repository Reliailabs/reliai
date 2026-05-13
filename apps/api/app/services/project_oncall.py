from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models.oncall_assignment import OncallAssignment
from app.models.oncall_escalation_policy import OncallEscalationPolicy
from app.models.oncall_rotation import OncallRotation
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.schemas.oncall import OncallAssignmentUpsert, OncallEscalationStepUpsert
from app.services.audit_log import log_action


VALID_ROLES = {"primary", "secondary", "lead", "sre"}
VALID_CHANNELS = {"slack", "phone", "email"}


def _normalize_role(value: str) -> str:
    return value.strip().lower().replace(" ", "_").replace("-", "_")


def get_or_create_project_oncall_rotation(db: Session, *, project: Project) -> OncallRotation:
    rotation = db.scalar(
        select(OncallRotation).where(
            OncallRotation.project_id == project.id,
            OncallRotation.is_active.is_(True),
        )
    )
    if rotation is not None:
        return rotation
    rotation = OncallRotation(
        organization_id=project.organization_id,
        project_id=project.id,
        name="Primary Rotation",
        timezone="UTC",
        is_active=True,
    )
    db.add(rotation)
    db.flush()
    return rotation


def get_project_oncall_snapshot(db: Session, *, project: Project) -> tuple[OncallRotation, list[OncallAssignment], list[OncallEscalationPolicy]]:
    rotation = get_or_create_project_oncall_rotation(db, project=project)
    assignments = list(
        db.scalars(
            select(OncallAssignment)
            .options(selectinload(OncallAssignment.user))
            .where(OncallAssignment.rotation_id == rotation.id)
            .order_by(OncallAssignment.role.asc())
        ).all()
    )
    steps = list(
        db.scalars(
            select(OncallEscalationPolicy)
            .where(OncallEscalationPolicy.rotation_id == rotation.id)
            .order_by(OncallEscalationPolicy.step_order.asc())
        ).all()
    )
    return rotation, assignments, steps


def _validate_membership(db: Session, *, organization_id: UUID, user_ids: set[UUID]) -> None:
    if not user_ids:
        return
    found = set(
        db.scalars(
            select(OrganizationMember.user_id).where(
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.user_id.in_(user_ids),
            )
        ).all()
    )
    missing = user_ids - found
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Users are not organization members: {', '.join(sorted(str(value) for value in missing))}",
        )


def upsert_project_oncall_assignments(
    db: Session,
    *,
    project: Project,
    items: list[OncallAssignmentUpsert],
    actor_user_id: UUID,
) -> list[OncallAssignment]:
    normalized_roles = [_normalize_role(item.role) for item in items]
    if any(role not in VALID_ROLES for role in normalized_roles):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid on-call role")
    if len(set(normalized_roles)) != len(normalized_roles):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate role assignments are not allowed")

    _validate_membership(db, organization_id=project.organization_id, user_ids={item.user_id for item in items})
    rotation = get_or_create_project_oncall_rotation(db, project=project)
    db.execute(delete(OncallAssignment).where(OncallAssignment.rotation_id == rotation.id))

    created: list[OncallAssignment] = []
    for item, role in zip(items, normalized_roles, strict=False):
        assignment = OncallAssignment(
            rotation_id=rotation.id,
            role=role,
            user_id=item.user_id,
            starts_at=item.starts_at,
            ends_at=item.ends_at,
        )
        db.add(assignment)
        created.append(assignment)

    log_action(
        db,
        organization_id=project.organization_id,
        user_id=actor_user_id,
        action="oncall_assignments_updated",
        resource_type="project",
        resource_id=project.id,
        metadata={"project_id": str(project.id), "assignment_count": len(items)},
    )
    db.commit()

    return list(
        db.scalars(
            select(OncallAssignment)
            .options(selectinload(OncallAssignment.user))
            .where(OncallAssignment.rotation_id == rotation.id)
            .order_by(OncallAssignment.role.asc())
        ).all()
    )


def upsert_project_oncall_escalation_policy(
    db: Session,
    *,
    project: Project,
    items: list[OncallEscalationStepUpsert],
    actor_user_id: UUID,
) -> list[OncallEscalationPolicy]:
    if len({item.step_order for item in items}) != len(items):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate escalation step_order values are not allowed")
    for item in items:
        role = _normalize_role(item.target_role)
        channel = item.channel.strip().lower()
        if role not in VALID_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid escalation target_role")
        if channel not in VALID_CHANNELS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid escalation channel")

    rotation = get_or_create_project_oncall_rotation(db, project=project)
    db.execute(delete(OncallEscalationPolicy).where(OncallEscalationPolicy.rotation_id == rotation.id))

    for item in sorted(items, key=lambda value: value.step_order):
        db.add(
            OncallEscalationPolicy(
                rotation_id=rotation.id,
                step_order=item.step_order,
                target_role=_normalize_role(item.target_role),
                wait_minutes=item.wait_minutes,
                channel=item.channel.strip().lower(),
            )
        )

    log_action(
        db,
        organization_id=project.organization_id,
        user_id=actor_user_id,
        action="oncall_escalation_policy_updated",
        resource_type="project",
        resource_id=project.id,
        metadata={"project_id": str(project.id), "step_count": len(items)},
    )
    db.commit()

    return list(
        db.scalars(
            select(OncallEscalationPolicy)
            .where(OncallEscalationPolicy.rotation_id == rotation.id)
            .order_by(OncallEscalationPolicy.step_order.asc())
        ).all()
    )
