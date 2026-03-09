import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.api_key import APIKey
from app.models.project import Project
from app.schemas.api_key import APIKeyCreate
from app.services.onboarding import mark_api_key_created


def _hash_key(plaintext_key: str) -> str:
    secret = get_settings().api_key_hash_secret
    return hashlib.sha256(f"{secret}:{plaintext_key}".encode("utf-8")).hexdigest()


def create_api_key(db: Session, project_id, payload: APIKeyCreate) -> tuple[APIKey, str]:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    secret = secrets.token_urlsafe(24)
    plaintext_key = f"reliai_{secret}"
    key_record = APIKey(
        project_id=project.id,
        key_prefix=plaintext_key[:12],
        key_hash=_hash_key(plaintext_key),
        label=payload.label,
    )
    db.add(key_record)
    db.flush()
    mark_api_key_created(db, project.organization_id)
    db.commit()
    db.refresh(key_record)
    return key_record, plaintext_key


def authenticate_api_key(db: Session, plaintext_key: str) -> APIKey | None:
    prefix = plaintext_key[:12]
    statement = select(APIKey).where(APIKey.key_prefix == prefix, APIKey.revoked_at.is_(None))
    candidates = db.scalars(statement).all()
    key_hash = _hash_key(plaintext_key)
    for candidate in candidates:
        if secrets.compare_digest(candidate.key_hash, key_hash):
            candidate.last_used_at = datetime.now(timezone.utc)
            db.add(candidate)
            db.flush()
            return candidate
    return None
