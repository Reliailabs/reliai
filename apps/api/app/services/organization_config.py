from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.organization import Organization
from app.models.organization_config_snapshot import OrganizationConfigSnapshot
from app.schemas.config import ConfigPatchItem
from app.services.auth import OperatorContext

ALLOWED_CONFIG_KEYS = {
    "retrieval_version",
    "temperature",
    "top_k",
    "similarity_threshold",
}


def _actor_label(operator: OperatorContext) -> str:
    return f"user:{operator.operator.email}"


def _latest_snapshot(db: Session, organization_id: UUID) -> OrganizationConfigSnapshot | None:
    return db.scalar(
        select(OrganizationConfigSnapshot)
        .where(OrganizationConfigSnapshot.organization_id == organization_id)
        .order_by(desc(OrganizationConfigSnapshot.created_at), desc(OrganizationConfigSnapshot.id))
    )


def _previous_snapshot(db: Session, organization_id: UUID) -> OrganizationConfigSnapshot | None:
    latest = _latest_snapshot(db, organization_id)
    if latest is None:
        return None
    return db.scalar(
        select(OrganizationConfigSnapshot)
        .where(
            OrganizationConfigSnapshot.organization_id == organization_id,
            OrganizationConfigSnapshot.created_at < latest.created_at,
        )
        .order_by(desc(OrganizationConfigSnapshot.created_at), desc(OrganizationConfigSnapshot.id))
    )


def _validate_patch_item(item: ConfigPatchItem) -> None:
    if item.key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported config key: {item.key}")


def _apply_patch(current: dict[str, Any], patch: list[ConfigPatchItem]) -> dict[str, Any]:
    next_config = dict(current)
    for item in patch:
        _validate_patch_item(item)
        current_value = next_config.get(item.key)
        if item.from_value is not None and current_value != item.from_value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Config mismatch for {item.key}",
            )
        next_config[item.key] = item.to
    return next_config


def apply_config_patch(
    db: Session,
    *,
    operator: OperatorContext,
    organization_id: UUID,
    patch: list[ConfigPatchItem],
    source_trace_id: str | None = None,
    reason: str | None = None,
) -> OrganizationConfigSnapshot:
    if not patch:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Patch cannot be empty")
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    latest = _latest_snapshot(db, organization_id)
    current_config = dict(latest.config_json) if latest is not None else {}
    next_config = _apply_patch(current_config, patch)

    snapshot = OrganizationConfigSnapshot(
        organization_id=organization_id,
        config_json=next_config,
        created_by=operator.operator.id,
        source_trace_id=source_trace_id,
        reason=reason,
    )
    db.add(snapshot)
    db.flush()
    db.add(
        AuditEvent(
            action="config_apply",
            actor_type="user",
            actor_id=operator.operator.id,
            actor_label=_actor_label(operator),
            target_type="organization",
            target_id=organization_id,
            target_label=organization.slug,
            organization_id=organization_id,
            metadata_json={
                "source": "config_apply",
                "patch": [item.model_dump(by_alias=True) for item in patch],
                "source_trace_id": source_trace_id,
            },
            reason=reason,
        )
    )
    db.commit()
    db.refresh(snapshot)
    return snapshot


def undo_config_patch(
    db: Session,
    *,
    operator: OperatorContext,
    organization_id: UUID,
    source_trace_id: str | None = None,
    reason: str | None = None,
) -> OrganizationConfigSnapshot:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    previous = _previous_snapshot(db, organization_id)
    if previous is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No previous config snapshot to restore")
    snapshot = OrganizationConfigSnapshot(
        organization_id=organization_id,
        config_json=dict(previous.config_json),
        created_by=operator.operator.id,
        source_trace_id=source_trace_id,
        reason=reason,
    )
    db.add(snapshot)
    db.flush()
    db.add(
        AuditEvent(
            action="config_undo",
            actor_type="user",
            actor_id=operator.operator.id,
            actor_label=_actor_label(operator),
            target_type="organization",
            target_id=organization_id,
            target_label=organization.slug,
            organization_id=organization_id,
            metadata_json={
                "source": "config_undo",
                "restored_snapshot_id": str(previous.id),
                "source_trace_id": source_trace_id,
            },
            reason=reason,
        )
    )
    db.commit()
    db.refresh(snapshot)
    return snapshot
