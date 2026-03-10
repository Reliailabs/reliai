from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from workos import WorkOSClient

from app.core.settings import get_settings
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.services.workos_roles import apply_workos_group_roles


@lru_cache
def _get_workos_client() -> WorkOSClient:
    settings = get_settings()
    if not settings.workos_api_key or not settings.workos_client_id:
        raise RuntimeError("WorkOS is not configured")
    return WorkOSClient(
        api_key=settings.workos_api_key,
        client_id=settings.workos_client_id,
    )


@lru_cache
def _get_jwks_client() -> PyJWKClient:
    return PyJWKClient(_get_workos_client().user_management.get_jwks_url())


def _utc_from_epoch(value: int | float | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(value, tz=timezone.utc)


def _decode_token(token: str) -> dict[str, Any]:
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    try:
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc


def _upsert_workos_user(db: Session, *, claims: dict[str, Any]) -> User:
    workos_user_id = str(claims.get("sub") or "")
    if not workos_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user = db.scalar(select(User).where(User.workos_user_id == workos_user_id))
    workos_user = _get_workos_client().user_management.get_user(workos_user_id)
    email = workos_user.email.strip().lower()

    if user is None:
        user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            workos_user_id=workos_user_id,
            email=email,
            is_active=True,
        )
        db.add(user)
        db.flush()
        return user

    user.workos_user_id = workos_user_id
    user.email = email
    user.is_active = True
    db.add(user)
    db.flush()
    return user


def authenticate_workos_token(db: Session, token: str):
    from app.services.auth import OperatorContext

    claims = _decode_token(token)
    user = _upsert_workos_user(db, claims=claims)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    memberships = db.scalars(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id)
    ).all()
    memberships = apply_workos_group_roles(db, user=user, claims=claims, memberships=list(memberships))
    db.commit()
    return OperatorContext(
        operator=user,
        memberships=memberships,
        expires_at=_utc_from_epoch(claims.get("exp")),
        auth_source="workos",
        session_token=None,
    )


def handle_scim_user_provisioned(
    db: Session,
    *,
    email: str,
    workos_user_id: str,
    groups: list[str] | None = None,
    organization_ids: list[str] | None = None,
) -> User:
    claims = {
        "sub": workos_user_id,
        "groups": groups or [],
        "organization_ids": organization_ids or [],
    }
    user = _upsert_workos_user(
        db,
        claims={"sub": workos_user_id},
    )
    user.email = email.strip().lower()
    user.is_active = True
    memberships = db.scalars(select(OrganizationMember).where(OrganizationMember.user_id == user.id)).all()
    apply_workos_group_roles(db, user=user, claims=claims, memberships=list(memberships))
    db.commit()
    db.refresh(user)
    return user


def handle_scim_user_deprovisioned(db: Session, *, workos_user_id: str) -> User:
    user = db.scalar(select(User).where(User.workos_user_id == workos_user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def handle_scim_group_updated(
    db: Session,
    *,
    workos_user_id: str,
    groups: list[str],
    organization_ids: list[str] | None = None,
) -> User:
    user = db.scalar(select(User).where(User.workos_user_id == workos_user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    memberships = db.scalars(select(OrganizationMember).where(OrganizationMember.user_id == user.id)).all()
    apply_workos_group_roles(
        db,
        user=user,
        claims={"groups": groups, "organization_ids": organization_ids or []},
        memberships=list(memberships),
    )
    db.commit()
    db.refresh(user)
    return user
