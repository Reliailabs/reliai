import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.operator_session import OperatorSession
from app.models.operator_user import OperatorUser
from app.models.organization_member import OrganizationMember
from app.schemas.auth import AuthSignInRequest


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
    operator: OperatorUser
    session: OperatorSession
    memberships: list[OrganizationMember]

    @property
    def organization_ids(self) -> list[UUID]:
        return [membership.organization_id for membership in self.memberships]


def create_operator_user(db: Session, *, email: str, password: str) -> OperatorUser:
    operator = OperatorUser(email=email.strip().lower(), password_hash=_hash_password(password))
    db.add(operator)
    db.flush()
    return operator


def sign_in_operator(db: Session, payload: AuthSignInRequest) -> tuple[OperatorUser, OperatorSession, str]:
    operator = db.scalar(select(OperatorUser).where(OperatorUser.email == payload.email))
    if operator is None or not operator.is_active or not verify_password(payload.password, operator.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    plaintext_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=get_settings().auth_session_days)
    session = OperatorSession(
        operator_user_id=operator.id,
        session_token_hash=hash_session_token(plaintext_token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(operator)
    db.refresh(session)
    return operator, session, plaintext_token


def get_operator_memberships(db: Session, operator_user_id: UUID) -> list[OrganizationMember]:
    return db.scalars(
        select(OrganizationMember).where(OrganizationMember.auth_user_id == str(operator_user_id))
    ).all()


def get_operator_context(db: Session, token: str) -> OperatorContext:
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

    memberships = get_operator_memberships(db, operator.id)
    session.last_used_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    return OperatorContext(operator=operator, session=session, memberships=memberships)


def revoke_session(db: Session, token: str) -> None:
    token_hash = hash_session_token(token)
    session = db.scalar(select(OperatorSession).where(OperatorSession.session_token_hash == token_hash))
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.add(session)
        db.commit()
