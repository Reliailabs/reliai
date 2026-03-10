from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    action: str,
    resource_type: str,
    resource_id: UUID | None,
    metadata: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json=metadata,
    )
    db.add(entry)
    db.flush()
    return entry
