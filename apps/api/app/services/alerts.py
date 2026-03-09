from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.alert_delivery import AlertDelivery
from app.models.incident import Incident

ALERT_CHANNEL_SLACK_WEBHOOK = "slack_webhook"
ALERT_TARGET_DEFAULT = "slack_webhook_default"
ALERT_STATUS_PENDING = "pending"
ALERT_STATUS_SENT = "sent"
ALERT_STATUS_FAILED = "failed"
ALERT_STATUS_SUPPRESSED = "suppressed"


def _current_time() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _slack_payload(incident: Incident) -> dict:
    summary = incident.summary_json
    metric_name = summary.get("metric_name", "unknown_metric")
    current_value = summary.get("current_value", "n/a")
    baseline_value = summary.get("baseline_value", "n/a")
    scope_type = summary.get("scope_type", "scope")
    scope_id = summary.get("scope_id", "n/a")
    incident_url = f"{get_settings().app_url}/incidents/{incident.id}"

    return {
        "text": f"[{incident.severity.upper()}] {incident.title}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{incident.title}*\nSeverity: `{incident.severity}`\nStatus: `{incident.status}`",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Metric*\n{metric_name}"},
                    {"type": "mrkdwn", "text": f"*Scope*\n{scope_type}:{scope_id}"},
                    {"type": "mrkdwn", "text": f"*Current*\n{current_value}"},
                    {"type": "mrkdwn", "text": f"*Baseline*\n{baseline_value}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"<{incident_url}|Open incident in Reliai>"},
            },
        ],
    }


def _latest_channel_delivery(
    db: Session, *, incident_id: UUID, channel_type: str, channel_target: str
) -> AlertDelivery | None:
    return db.scalar(
        select(AlertDelivery)
        .where(
            AlertDelivery.incident_id == incident_id,
            AlertDelivery.channel_type == channel_type,
            AlertDelivery.channel_target == channel_target,
        )
        .order_by(desc(AlertDelivery.created_at), desc(AlertDelivery.id))
    )


def _has_recent_pending_or_sent_delivery(
    db: Session,
    *,
    incident_id: UUID,
    channel_type: str,
    channel_target: str,
    cutoff: datetime,
) -> bool:
    deliveries = db.scalars(
        select(AlertDelivery).where(
            AlertDelivery.incident_id == incident_id,
            AlertDelivery.channel_type == channel_type,
            AlertDelivery.channel_target == channel_target,
            AlertDelivery.created_at >= cutoff,
        )
    ).all()
    for delivery in deliveries:
        if delivery.delivery_status == ALERT_STATUS_PENDING:
            return True
        if delivery.sent_at is not None and _as_utc(delivery.sent_at) >= cutoff:
            return True
    return False


def create_alert_deliveries_for_open_incidents(
    db: Session, *, incidents: list[Incident]
) -> list[AlertDelivery]:
    settings = get_settings()
    deliveries: list[AlertDelivery] = []

    for incident in incidents:
        if settings.slack_webhook_default is None:
            delivery = AlertDelivery(
                incident_id=incident.id,
                channel_type=ALERT_CHANNEL_SLACK_WEBHOOK,
                channel_target=ALERT_TARGET_DEFAULT,
                delivery_status=ALERT_STATUS_FAILED,
                error_message="Slack webhook is not configured",
            )
            db.add(delivery)
            db.flush()
            deliveries.append(delivery)
            continue

        now = _current_time()
        cooldown_cutoff = now - timedelta(minutes=settings.alert_delivery_cooldown_minutes)
        if _has_recent_pending_or_sent_delivery(
            db,
            incident_id=incident.id,
            channel_type=ALERT_CHANNEL_SLACK_WEBHOOK,
            channel_target=ALERT_TARGET_DEFAULT,
            cutoff=cooldown_cutoff,
        ):
            suppressed = AlertDelivery(
                incident_id=incident.id,
                channel_type=ALERT_CHANNEL_SLACK_WEBHOOK,
                channel_target=ALERT_TARGET_DEFAULT,
                delivery_status=ALERT_STATUS_SUPPRESSED,
                error_message="Suppressed by alert cooldown",
            )
            db.add(suppressed)
            db.flush()
            deliveries.append(suppressed)
            continue

        delivery = AlertDelivery(
            incident_id=incident.id,
            channel_type=ALERT_CHANNEL_SLACK_WEBHOOK,
            channel_target=ALERT_TARGET_DEFAULT,
            delivery_status=ALERT_STATUS_PENDING,
        )
        db.add(delivery)
        db.flush()
        deliveries.append(delivery)

    return deliveries


def deliver_alert_delivery(db: Session, delivery_id: UUID) -> AlertDelivery | None:
    delivery = db.get(AlertDelivery, delivery_id)
    if delivery is None:
        return None
    if delivery.delivery_status != ALERT_STATUS_PENDING:
        return delivery

    incident = db.get(Incident, delivery.incident_id)
    if incident is None:
        delivery.delivery_status = ALERT_STATUS_FAILED
        delivery.error_message = "Incident not found"
        db.add(delivery)
        db.commit()
        return delivery

    webhook = get_settings().slack_webhook_default
    if webhook is None:
        delivery.delivery_status = ALERT_STATUS_FAILED
        delivery.error_message = "Slack webhook is not configured"
        db.add(delivery)
        db.commit()
        return delivery

    try:
        response = httpx.post(webhook, json=_slack_payload(incident), timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        delivery.delivery_status = ALERT_STATUS_FAILED
        delivery.error_message = str(exc)
        db.add(delivery)
        db.commit()
        return delivery

    delivery.delivery_status = ALERT_STATUS_SENT
    delivery.provider_message_id = response.headers.get("x-slack-req-id")
    delivery.sent_at = _current_time()
    delivery.error_message = None
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


def mark_delivery_enqueue_failed(db: Session, delivery_id: UUID, error_message: str) -> None:
    delivery = db.get(AlertDelivery, delivery_id)
    if delivery is None:
        return
    delivery.delivery_status = ALERT_STATUS_FAILED
    delivery.error_message = error_message
    db.add(delivery)
    db.commit()
