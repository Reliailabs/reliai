from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.organization_invitation import OrganizationInvitation
from app.services.audit_log import log_action
from app.services.workos_roles import normalize_org_role


INVITE_TTL_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def list_organization_invitations(db: Session, *, organization_id: UUID) -> list[OrganizationInvitation]:
    now = _now()
    return list(
        db.scalars(
            select(OrganizationInvitation)
            .where(
                OrganizationInvitation.organization_id == organization_id,
                OrganizationInvitation.accepted_at.is_(None),
                OrganizationInvitation.expires_at > now,
            )
            .order_by(OrganizationInvitation.created_at.asc(), OrganizationInvitation.id.asc())
        ).all()
    )


def _generate_token(db: Session) -> str:
    for _ in range(8):
        token = secrets.token_urlsafe(24)
        existing = db.scalar(
            select(OrganizationInvitation.id).where(OrganizationInvitation.token == token)
        )
        if existing is None:
            return token
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to allocate invitation token")


def create_organization_invitation(
    db: Session,
    *,
    organization_id: UUID,
    invited_email: str,
    role: str,
    invited_by_user_id: UUID,
) -> OrganizationInvitation:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    normalized_email = invited_email.strip().lower()
    normalized_role = normalize_org_role(role)
    existing_pending = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization_id,
            OrganizationInvitation.invited_email == normalized_email,
            OrganizationInvitation.accepted_at.is_(None),
            OrganizationInvitation.expires_at > _now(),
        )
    )
    if existing_pending is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already pending")

    invitation = OrganizationInvitation(
        organization_id=organization_id,
        invited_email=normalized_email,
        role=normalized_role,
        invited_by_user_id=invited_by_user_id,
        token=_generate_token(db),
        expires_at=_now() + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invitation)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already pending") from exc
    log_action(
        db,
        organization_id=organization_id,
        user_id=invited_by_user_id,
        action="organization_invitation_created",
        resource_type="organization_invitation",
        resource_id=invitation.id,
        metadata={"invited_email": invitation.invited_email, "role": invitation.role},
    )
    db.commit()
    db.refresh(invitation)
    return invitation


def revoke_organization_invitation(
    db: Session,
    *,
    organization_id: UUID,
    invitation_id: UUID,
    actor_user_id: UUID,
) -> None:
    invitation = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization_id,
            OrganizationInvitation.id == invitation_id,
        )
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    db.execute(delete(OrganizationInvitation).where(OrganizationInvitation.id == invitation.id))
    log_action(
        db,
        organization_id=organization_id,
        user_id=actor_user_id,
        action="organization_invitation_revoked",
        resource_type="organization_invitation",
        resource_id=invitation.id,
        metadata={"invited_email": invitation.invited_email, "role": invitation.role},
    )
    db.commit()
