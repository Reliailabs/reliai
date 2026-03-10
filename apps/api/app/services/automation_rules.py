from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.automation_rule import AutomationRule
from app.models.incident import Incident
from app.models.organization_alert_target import OrganizationAlertTarget
from app.models.project import Project
from app.core.settings import get_settings
from app.services.alerts import ALERT_CHANNEL_SLACK_WEBHOOK
from app.services.event_stream import AutomationTriggeredEventPayload, EventMessage, publish_event
from app.services.incidents import (
    INCIDENT_EVENT_OPENED,
    INCIDENT_EVENT_REOPENED,
    append_incident_event,
)

ACTION_CREATE_INCIDENT = "create_incident"
ACTION_SEND_WEBHOOK = "send_webhook"
ACTION_SEND_SLACK_ALERT = "send_slack_alert"
ACTION_TRIGGER_PROCESSOR = "trigger_processor"


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _event_timestamp(event: EventMessage) -> datetime:
    raw = event.payload.get("timestamp") or event.payload.get("detected_at") or event.payload.get("deployed_at")
    if isinstance(raw, datetime):
        return _as_utc(raw)
    if isinstance(raw, str):
        return _as_utc(datetime.fromisoformat(raw.replace("Z", "+00:00")))
    return _as_utc(event.published_at)


def _enabled_rules(db: Session, *, project_id: UUID, event_type: str) -> list[AutomationRule]:
    return list(
        db.scalars(
            select(AutomationRule)
            .where(
                AutomationRule.project_id == project_id,
                AutomationRule.event_type == event_type,
                AutomationRule.enabled.is_(True),
            )
            .order_by(AutomationRule.created_at.asc(), AutomationRule.name.asc())
        ).all()
    )


def _lookup_path(payload: dict[str, Any], path: str | None) -> Any:
    if not path:
        return None
    current: Any = payload
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    if operator == "eq":
        return actual == expected
    if operator == "neq":
        return actual != expected
    if operator == "contains":
        return actual is not None and str(expected) in str(actual)
    actual_decimal = _to_decimal(actual)
    expected_decimal = _to_decimal(expected)
    if actual_decimal is None or expected_decimal is None:
        return False
    if operator == "gt":
        return actual_decimal > expected_decimal
    if operator == "gte":
        return actual_decimal >= expected_decimal
    if operator == "lt":
        return actual_decimal < expected_decimal
    if operator == "lte":
        return actual_decimal <= expected_decimal
    return False


def _matches_condition(condition: dict[str, Any], payload: dict[str, Any]) -> bool:
    if "all" in condition:
        return all(_matches_condition(item, payload) for item in condition.get("all", []))
    if "any" in condition:
        return any(_matches_condition(item, payload) for item in condition.get("any", []))
    field = condition.get("field")
    operator = condition.get("operator", "eq")
    expected = condition.get("value")
    actual = _lookup_path(payload, field)
    return _compare(actual, operator, expected)


def _active_slack_target(db: Session, organization_id: UUID) -> OrganizationAlertTarget | None:
    return db.scalar(
        select(OrganizationAlertTarget).where(
            OrganizationAlertTarget.organization_id == organization_id,
            OrganizationAlertTarget.channel_type == ALERT_CHANNEL_SLACK_WEBHOOK,
            OrganizationAlertTarget.is_active.is_(True),
        )
    )


def _sign(secret: str, payload: dict[str, Any]) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _trigger_record_payload(rule: AutomationRule, event: EventMessage) -> dict[str, Any]:
    return AutomationTriggeredEventPayload(
        project_id=str(rule.project_id),
        rule_id=str(rule.id),
        source_event_type=event.event_type,
        action_type=rule.action_type,
        metadata={
            "rule_name": rule.name,
            "source_payload": event.payload,
        },
    ).model_dump(mode="json")


def _incident_fingerprint(rule: AutomationRule, event: EventMessage) -> str:
    base = event.payload.get("trace_id") or event.payload.get("deployment_id") or event.payload.get("regression_snapshot_id")
    return f"automation:{rule.id}:{event.event_type}:{base or event.offset}"


def _execute_create_incident(db: Session, *, rule: AutomationRule, project: Project, event: EventMessage) -> None:
    action_config = rule.action_config or {}
    timestamp = _event_timestamp(event)
    fingerprint = _incident_fingerprint(rule, event)
    incident = db.scalar(select(Incident).where(Incident.fingerprint == fingerprint))
    summary_json = {
        "metric_name": action_config.get("metric_name", event.payload.get("metric_name", event.event_type)),
        "automation_rule_id": str(rule.id),
        "source_event_type": event.event_type,
        "source_payload": event.payload,
    }
    if incident is None:
        incident = Incident(
            organization_id=project.organization_id,
            project_id=project.id,
            deployment_id=UUID(str(event.payload["deployment_id"])) if event.payload.get("deployment_id") else None,
            incident_type=action_config.get("incident_type", "automation_rule"),
            severity=action_config.get("severity", "medium"),
            title=action_config.get("title", rule.name),
            status="open",
            fingerprint=fingerprint,
            summary_json=summary_json,
            started_at=timestamp,
            updated_at=timestamp,
        )
        db.add(incident)
        db.flush()
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_OPENED,
            metadata_json={"automation_rule_id": str(rule.id), "source_event_type": event.event_type},
            created_at=timestamp,
        )
        return
    incident.summary_json = summary_json
    incident.updated_at = timestamp
    if incident.status == "resolved":
        incident.status = "open"
        incident.started_at = timestamp
        incident.resolved_at = None
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_REOPENED,
            metadata_json={"automation_rule_id": str(rule.id), "source_event_type": event.event_type},
            created_at=timestamp,
        )
    db.add(incident)
    db.flush()


def _execute_send_webhook(rule: AutomationRule, event: EventMessage) -> None:
    action_config = rule.action_config or {}
    target_url = action_config.get("url")
    if not target_url:
        raise ValueError("send_webhook action requires action_config.url")
    payload = {
        "rule_id": str(rule.id),
        "rule_name": rule.name,
        "project_id": str(rule.project_id),
        "event_type": event.event_type,
        "payload": event.payload,
    }
    headers = {"Content-Type": "application/json"}
    secret = action_config.get("secret")
    if secret:
        headers["X-Reliai-Signature"] = _sign(str(secret), payload)
    httpx.post(str(target_url), json=payload, headers=headers, timeout=10.0).raise_for_status()


def _execute_send_slack_alert(db: Session, *, rule: AutomationRule, project: Project, event: EventMessage) -> None:
    target = _active_slack_target(db, project.organization_id)
    if target is None:
        raise ValueError("send_slack_alert action requires an active organization slack webhook")
    payload = {
        "text": f"[AUTOMATION] {rule.name}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{rule.name}*\nEvent: `{event.event_type}`\nProject: `{project.name}`",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Action*\n{rule.action_type}"},
                    {"type": "mrkdwn", "text": f"*Condition*\n```{json.dumps(rule.condition_json, sort_keys=True)}```"},
                ],
            },
        ],
    }
    httpx.post(target.slack_webhook_url, json=payload, timeout=10.0).raise_for_status()


def _execute_trigger_processor(rule: AutomationRule, event: EventMessage) -> None:
    action_config = rule.action_config or {}
    processor_event_type = action_config.get("event_type")
    if not processor_event_type:
        raise ValueError("trigger_processor action requires action_config.event_type")
    payload = {
        "event_type": str(processor_event_type),
        "project_id": str(rule.project_id),
        "rule_id": str(rule.id),
        "source_event_type": event.event_type,
        "source_payload": event.payload,
        "metadata": action_config.get("metadata", {}),
    }
    publish_event(get_settings().event_stream_topic_traces, payload)


def evaluate_automation_rules(db: Session, event: EventMessage) -> list[str]:
    project_id = event.payload.get("project_id")
    if project_id is None:
        return []
    project = db.get(Project, UUID(str(project_id)))
    if project is None:
        return []
    triggered: list[AutomationRule] = []
    for rule in _enabled_rules(db, project_id=project.id, event_type=event.event_type):
        if not _matches_condition(rule.condition_json, event.payload):
            continue
        if rule.action_type == ACTION_CREATE_INCIDENT:
            _execute_create_incident(db, rule=rule, project=project, event=event)
        elif rule.action_type == ACTION_SEND_WEBHOOK:
            _execute_send_webhook(rule, event)
        elif rule.action_type == ACTION_SEND_SLACK_ALERT:
            _execute_send_slack_alert(db, rule=rule, project=project, event=event)
        elif rule.action_type == ACTION_TRIGGER_PROCESSOR:
            _execute_trigger_processor(rule, event)
        else:
            raise ValueError(f"Unsupported automation action '{rule.action_type}'")
        triggered.append(rule)
    db.commit()
    for rule in triggered:
        publish_event(get_settings().event_stream_topic_traces, _trigger_record_payload(rule, event))
    return [str(rule.id) for rule in triggered]
