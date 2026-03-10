from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.organization import Organization
from app.models.public_api_key import PublicApiKey
from app.services.audit_log import log_action


def _hash_key(plaintext_key: str) -> str:
    secret = get_settings().api_key_hash_secret
    return hashlib.sha256(f"{secret}:public:{plaintext_key}".encode("utf-8")).hexdigest()


def create_public_api_key(
    db: Session,
    *,
    organization_id: UUID,
    name: str,
    actor_user_id: UUID,
) -> tuple[PublicApiKey, str]:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    secret = secrets.token_urlsafe(24)
    plaintext_key = f"reliai_pub_{secret}"
    record = PublicApiKey(
        organization_id=organization_id,
        key_prefix=plaintext_key[:16],
        key_hash=_hash_key(plaintext_key),
        name=name.strip(),
        revoked=False,
    )
    db.add(record)
    db.flush()
    log_action(
        db,
        organization_id=organization_id,
        user_id=actor_user_id,
        action="public_api_key_created",
        resource_type="public_api_key",
        resource_id=record.id,
        metadata={"name": record.name},
    )
    db.commit()
    db.refresh(record)
    return record, plaintext_key


def list_public_api_keys(db: Session, *, organization_id: UUID) -> list[PublicApiKey]:
    return list(
        db.scalars(
            select(PublicApiKey)
            .where(PublicApiKey.organization_id == organization_id)
            .order_by(PublicApiKey.created_at.desc(), PublicApiKey.name.asc())
        ).all()
    )


def revoke_public_api_key(
    db: Session,
    *,
    organization_id: UUID,
    key_id: UUID,
    actor_user_id: UUID,
) -> PublicApiKey:
    record = db.scalar(
        select(PublicApiKey).where(
            PublicApiKey.id == key_id,
            PublicApiKey.organization_id == organization_id,
        )
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    record.revoked = True
    db.add(record)
    log_action(
        db,
        organization_id=organization_id,
        user_id=actor_user_id,
        action="public_api_key_revoked",
        resource_type="public_api_key",
        resource_id=record.id,
        metadata={"name": record.name},
    )
    db.commit()
    db.refresh(record)
    return record


def authenticate_public_api_key(db: Session, plaintext_key: str) -> PublicApiKey | None:
    prefix = plaintext_key[:16]
    candidates = db.scalars(
        select(PublicApiKey).where(
            PublicApiKey.key_prefix == prefix,
            PublicApiKey.revoked.is_(False),
        )
    ).all()
    key_hash = _hash_key(plaintext_key)
    for candidate in candidates:
        if secrets.compare_digest(candidate.key_hash, key_hash):
            candidate.last_used_at = datetime.now(timezone.utc)
            db.add(candidate)
            db.flush()
            return candidate
    return None
