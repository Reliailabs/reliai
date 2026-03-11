import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.operator_session import OperatorSession
from app.models.operator_user import OperatorUser
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.schemas.auth import AuthSignInRequest
from app.services.auth_workos import authenticate_workos_token


def _current_time_like(value: datetime) -> datetime:
    if value.tzinfo is None:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    return datetime.now(timezone.utc)


def _hash_password(password: str, *, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return "pbkdf2_sha256$600000$%s$%s" % (
        base64.urlsafe_b64encode(salt).decode("utf-8"),
        base64.urlsafe_b64encode(derived).decode("utf-8"),
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    salt = base64.urlsafe_b64decode(salt_b64.encode("utf-8"))
    expected = base64.urlsafe_b64decode(digest_b64.encode("utf-8"))
    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        int(iterations),
    )
    return hmac.compare_digest(candidate, expected)


def hash_session_token(token: str) -> str:
    secret = get_settings().auth_session_hash_secret
    return hashlib.sha256(f"{secret}:{token}".encode("utf-8")).hexdigest()


@dataclass
class OperatorContext:
    operator: User
    memberships: list[OrganizationMember]
    expires_at: datetime
    auth_source: str
    session_token: str | None = None
    active_organization_id: UUID | None = None

    @property
    def organization_ids(self) -> list[UUID]:
        return [membership.organization_id for membership in self.memberships]


def _resolve_active_organization_id(
    db: Session,
    *,
    user: User,
    memberships: list[OrganizationMember],
) -> UUID | None:
    membership_ids = [membership.organization_id for membership in memberships]
    if user.active_organization_id in membership_ids:
        return user.active_organization_id
    active = membership_ids[0] if membership_ids else None
    if user.active_organization_id != active:
        user.active_organization_id = active
        db.add(user)
        db.flush()
    return active


def set_active_organization(
    db: Session,
    *,
    user: User,
    organization_id: UUID,
) -> User:
    memberships = get_operator_memberships(db, user.id)
    if organization_id not in [membership.organization_id for membership in memberships]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user.active_organization_id = organization_id
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _dev_auth_enabled() -> bool:
    settings = get_settings()
    return settings.app_env != "production" and settings.workos_dev_auth_enabled


def _workos_enabled() -> bool:
    settings = get_settings()
    return bool(settings.workos_api_key and settings.workos_client_id)


def _get_or_create_app_user(
    db: Session,
    *,
    email: str,
    legacy_operator_user_id: UUID | None = None,
    workos_user_id: str | None = None,
    is_active: bool = True,
) -> User:
    statement = select(User).where(User.email == email.strip().lower())
    user = db.scalar(statement)
    if user is None and workos_user_id is not None:
        user = db.scalar(select(User).where(User.workos_user_id == workos_user_id))
    if user is None and legacy_operator_user_id is not None:
        user = db.scalar(select(User).where(User.legacy_operator_user_id == legacy_operator_user_id))
    if user is None:
        user = User(
            id=legacy_operator_user_id or None,
            legacy_operator_user_id=legacy_operator_user_id,
            workos_user_id=workos_user_id,
            email=email.strip().lower(),
            is_active=is_active,
        )
        db.add(user)
        db.flush()
        return user

    user.email = email.strip().lower()
    user.is_active = is_active
    if user.workos_user_id is None and workos_user_id is not None:
        user.workos_user_id = workos_user_id
    if user.legacy_operator_user_id is None and legacy_operator_user_id is not None:
        user.legacy_operator_user_id = legacy_operator_user_id
    db.add(user)
    db.flush()
    return user


def create_operator_user(
    db: Session,
    *,
    email: str,
    password: str,
    is_system_admin: bool = False,
) -> OperatorUser:
    operator = OperatorUser(email=email.strip().lower(), password_hash=_hash_password(password))
    db.add(operator)
    db.flush()
    user = _get_or_create_app_user(
        db,
        email=operator.email,
        legacy_operator_user_id=operator.id,
        is_active=operator.is_active,
    )
    user.is_system_admin = is_system_admin
    db.add(user)
    db.flush()
    return operator


def sign_in_operator(db: Session, payload: AuthSignInRequest) -> tuple[User, OperatorSession, str]:
    if not _dev_auth_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    operator = db.scalar(select(OperatorUser).where(OperatorUser.email == payload.email))
    if operator is None or not operator.is_active or not verify_password(payload.password, operator.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    app_user = _get_or_create_app_user(
        db,
        email=operator.email,
        legacy_operator_user_id=operator.id,
        is_active=operator.is_active,
    )

    plaintext_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=get_settings().auth_session_days)
    session = OperatorSession(
        operator_user_id=operator.id,
        session_token_hash=hash_session_token(plaintext_token),
        expires_at=expires_at,
    )
    db.add(session)
    memberships = get_operator_memberships(db, app_user.id)
    _resolve_active_organization_id(db, user=app_user, memberships=memberships)
    db.commit()
    db.refresh(app_user)
    db.refresh(session)
    return app_user, session, plaintext_token


def get_operator_memberships(db: Session, user_id: UUID) -> list[OrganizationMember]:
    return db.scalars(
        select(OrganizationMember).where(
            or_(
                OrganizationMember.user_id == user_id,
                OrganizationMember.auth_user_id == str(user_id),
            )
        )
    ).all()


def get_legacy_operator_context(db: Session, token: str) -> OperatorContext:
    if not _dev_auth_enabled():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    token_hash = hash_session_token(token)
    session = db.scalar(
        select(OperatorSession).where(
            OperatorSession.session_token_hash == token_hash,
            OperatorSession.revoked_at.is_(None),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    if session.expires_at <= _current_time_like(session.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    operator = db.get(OperatorUser, session.operator_user_id)
    if operator is None or not operator.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    app_user = _get_or_create_app_user(
        db,
        email=operator.email,
        legacy_operator_user_id=operator.id,
        is_active=operator.is_active,
    )
    memberships = get_operator_memberships(db, app_user.id)
    active_organization_id = _resolve_active_organization_id(db, user=app_user, memberships=memberships)
    session.last_used_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    return OperatorContext(
        operator=app_user,
        memberships=memberships,
        expires_at=session.expires_at,
        auth_source="legacy",
        session_token=token,
        active_organization_id=active_organization_id,
    )


def get_operator_context(db: Session, token: str) -> OperatorContext:
    if _workos_enabled() and token.count(".") == 2:
        return authenticate_workos_token(db, token)
    if _dev_auth_enabled():
        return get_legacy_operator_context(db, token)
    if _workos_enabled():
        return authenticate_workos_token(db, token)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def revoke_session(db: Session, token: str) -> None:
    token_hash = hash_session_token(token)
    session = db.scalar(select(OperatorSession).where(OperatorSession.session_token_hash == token_hash))
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.add(session)
        db.commit()


def switch_active_organization(
    db: Session,
    *,
    operator: OperatorContext,
    organization_id: UUID,
) -> OperatorContext:
    if organization_id not in operator.organization_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = db.get(User, operator.operator.id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.active_organization_id = organization_id
    db.add(user)
    db.commit()
    db.refresh(user)
    return OperatorContext(
        operator=user,
        memberships=operator.memberships,
        expires_at=operator.expires_at,
        auth_source=operator.auth_source,
        session_token=operator.session_token,
        active_organization_id=organization_id,
    )
