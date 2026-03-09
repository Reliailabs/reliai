from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.organization_alert_target import OrganizationAlertTarget
from app.schemas.organization_alert_target import OrganizationAlertTargetUpsertRequest

ALERT_TARGET_CHANNEL_SLACK = "slack_webhook"


def _mask_webhook(value: str | None) -> str | None:
    if value is None or len(value) < 10:
        return None
    return f"{value[:20]}...{value[-6:]}"


def get_org_alert_target(db: Session, organization_id: UUID) -> OrganizationAlertTarget:
    target = db.scalar(
        select(OrganizationAlertTarget).where(
            OrganizationAlertTarget.organization_id == organization_id,
            OrganizationAlertTarget.channel_type == ALERT_TARGET_CHANNEL_SLACK,
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert target not found")
    return target


def upsert_org_alert_target(
    db: Session,
    *,
    organization_id: UUID,
    payload: OrganizationAlertTargetUpsertRequest,
) -> OrganizationAlertTarget:
    target = db.scalar(
        select(OrganizationAlertTarget).where(
            OrganizationAlertTarget.organization_id == organization_id,
            OrganizationAlertTarget.channel_type == ALERT_TARGET_CHANNEL_SLACK,
        )
    )
    if target is None:
        if payload.slack_webhook_url is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slack webhook URL is required to create an alert target",
            )
        target = OrganizationAlertTarget(
            organization_id=organization_id,
            channel_type=ALERT_TARGET_CHANNEL_SLACK,
            channel_target=payload.channel_target,
            slack_webhook_url=str(payload.slack_webhook_url),
            is_active=payload.is_active,
        )
    else:
        target.channel_target = payload.channel_target
        target.is_active = payload.is_active
        if payload.slack_webhook_url is not None:
            target.slack_webhook_url = str(payload.slack_webhook_url)
        target.updated_at = datetime.now(timezone.utc)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def set_org_alert_target_enabled(
    db: Session,
    *,
    organization_id: UUID,
    enabled: bool,
) -> OrganizationAlertTarget:
    target = get_org_alert_target(db, organization_id)
    target.is_active = enabled
    target.updated_at = datetime.now(timezone.utc)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def test_org_alert_target(db: Session, organization_id: UUID) -> tuple[bool, str]:
    target = get_org_alert_target(db, organization_id)
    try:
        response = httpx.post(
            target.slack_webhook_url,
            json={
                "text": "Reliai test alert",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "*Reliai test alert*\nThis verifies the org-level Slack target.",
                        },
                    }
                ],
            },
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        return False, str(exc)
    return True, "Slack target responded successfully"


def org_alert_target_read_model(target: OrganizationAlertTarget) -> dict:
    return {
        "id": target.id,
        "organization_id": target.organization_id,
        "channel_type": target.channel_type,
        "channel_target": target.channel_target,
        "is_active": target.is_active,
        "has_secret": bool(target.slack_webhook_url),
        "webhook_masked": _mask_webhook(target.slack_webhook_url),
        "created_at": target.created_at,
        "updated_at": target.updated_at,
    }
