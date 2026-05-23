from __future__ import annotations

import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.organization_invitation import OrganizationInvitation
from app.models.operator_user import OperatorUser
from app.models.operator_session import OperatorSession
from app.models.user import User
from app.core.settings import get_settings
from app.security.webhook_signing import sign_webhook_payload
from app.services.audit_log import log_action
from app.services.auth import get_or_create_app_user, get_or_create_operator_account, issue_operator_session
from app.services.workos_roles import normalize_org_role


INVITE_TTL_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_like(value: datetime) -> datetime:
    now = _now()
    return now.replace(tzinfo=None) if value.tzinfo is None else now


def list_organization_invitations(db: Session, *, organization_id: UUID) -> list[OrganizationInvitation]:
    now = _now()
    return list(
        db.scalars(
            select(OrganizationInvitation)
            .options(joinedload(OrganizationInvitation.organization), joinedload(OrganizationInvitation.invited_by_user))
            .where(
                OrganizationInvitation.organization_id == organization_id,
                OrganizationInvitation.accepted_at.is_(None),
                OrganizationInvitation.expires_at > now,
            )
            .order_by(OrganizationInvitation.created_at.asc(), OrganizationInvitation.id.asc())
        ).all()
    )


def get_organization_invitation_by_token(db: Session, *, token: str) -> OrganizationInvitation:
    invitation = db.scalar(
        select(OrganizationInvitation)
        .options(joinedload(OrganizationInvitation.organization), joinedload(OrganizationInvitation.invited_by_user))
        .where(
            OrganizationInvitation.token == token,
            OrganizationInvitation.accepted_at.is_(None),
            OrganizationInvitation.expires_at > _now(),
        )
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    return invitation


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


def dispatch_organization_invitation_delivery(db: Session, *, invitation_id: UUID) -> OrganizationInvitation:
    invitation = db.scalar(
        select(OrganizationInvitation)
        .options(joinedload(OrganizationInvitation.organization), joinedload(OrganizationInvitation.invited_by_user))
        .where(OrganizationInvitation.id == invitation_id)
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    settings = get_settings()
    webhook_url = (settings.invite_delivery_webhook_url or "").strip()
    if not webhook_url:
        invitation.delivery_mode = "manual_join_link"
        invitation.email_sent_at = None
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        return invitation
    signing_secret = (settings.invite_delivery_webhook_signing_secret or "").strip()
    if not signing_secret:
        invitation.delivery_mode = "manual_join_link"
        invitation.email_sent_at = None
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        return invitation

    invited_by_user = getattr(invitation, "invited_by_user", None)
    organization = getattr(invitation, "organization", None)
    payload = {
        "event": "organization_invitation.created",
        "invitation": {
            "id": str(invitation.id),
            "organization_id": str(invitation.organization_id),
            "organization_name": getattr(organization, "name", None),
            "invited_email": invitation.invited_email,
            "role": invitation.role,
            "invited_by_email": getattr(invited_by_user, "email", None),
            "signup_path": f"/signup?entry=team-invite&email={invitation.invited_email}",
            "join_path": f"/join?token={invitation.token}",
            "expires_at": invitation.expires_at.isoformat(),
            "created_at": invitation.created_at.isoformat(),
        },
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    timestamp = int(time.time())
    signature = sign_webhook_payload(secret=signing_secret, timestamp=timestamp, body=body)
    webhook_id = secrets.token_hex(16)
    headers["X-Reliai-Webhook-Id"] = webhook_id
    headers["X-Reliai-Signature-Version"] = settings.invite_delivery_webhook_signature_version
    headers["X-Reliai-Timestamp"] = str(timestamp)
    headers["X-Reliai-Signature"] = signature
    request = Request(webhook_url, data=body, headers=headers, method="POST")
    try:
        with urlopen(request, timeout=max(1, settings.invite_delivery_webhook_timeout_seconds)) as response:
            status_code = getattr(response, "status", 200)
            if 200 <= status_code < 300:
                invitation.delivery_mode = "email_webhook_dispatched"
                invitation.email_sent_at = _now_like(invitation.expires_at)
            else:
                invitation.delivery_mode = "manual_join_link"
                invitation.email_sent_at = None
    except URLError:
        invitation.delivery_mode = "manual_join_link"
        invitation.email_sent_at = None

    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def accept_organization_invitation(
    db: Session,
    *,
    token: str,
) -> tuple[OrganizationInvitation, User, OperatorSession, str]:
    invitation = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.token == token,
        )
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already accepted")
    if invitation.expires_at <= _now_like(invitation.expires_at):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation expired")

    operator_user, app_user = get_or_create_operator_account(
        db,
        email=invitation.invited_email,
    )
    existing_membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == invitation.organization_id,
            OrganizationMember.user_id == app_user.id,
        )
    )
    if existing_membership is None:
        membership = OrganizationMember(
            organization_id=invitation.organization_id,
            user_id=app_user.id,
            auth_user_id=str(app_user.id),
            role=normalize_org_role(invitation.role),
        )
        db.add(membership)
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists") from exc

    app_user.active_organization_id = invitation.organization_id
    db.add(app_user)
    invitation.accepted_at = _now()
    db.add(invitation)
    log_action(
        db,
        organization_id=invitation.organization_id,
        user_id=app_user.id,
        action="organization_invitation_accepted",
        resource_type="organization_invitation",
        resource_id=invitation.id,
        metadata={"invited_email": invitation.invited_email, "role": invitation.role},
    )
    session, session_token = issue_operator_session(db, operator_user_id=operator_user.id)
    db.commit()
    db.refresh(invitation)
    db.refresh(app_user)
    db.refresh(session)
    return invitation, app_user, session, session_token


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
