from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.automation_rule import AutomationRule
from app.models.incident import Incident
from app.models.organization_alert_target import OrganizationAlertTarget
from app.models.project import Project
from app.models.reliability_action_log import ReliabilityActionLog
from app.core.settings import get_settings
from app.services.deployments import most_recent_project_deployment
from app.services.alerts import ALERT_CHANNEL_SLACK_WEBHOOK
from app.services.event_stream import AutomationTriggeredEventPayload, EventMessage, publish_event
from app.services.incidents import (
    INCIDENT_EVENT_OPENED,
    INCIDENT_EVENT_REOPENED,
    append_incident_event,
)
from app.services.reliability_graph import get_graph_guardrail_recommendations
from app.services.reliability_actions import (
    ACTION_STATUS_DRY_RUN,
    ACTION_STATUS_SKIPPED_COOLDOWN,
    ACTION_STATUS_SKIPPED_FREQUENCY,
    ACTION_STATUS_SUCCESS,
    disable_processor,
    enable_guardrail,
    increase_sampling,
    log_reliability_action,
    rollback_deployment,
)

RULE_SOURCE_MANUAL = "manual"
RULE_SOURCE_SYSTEM = "system"
RULE_SOURCE_GRAPH_INTELLIGENCE = "graph_intelligence"

ACTION_CREATE_INCIDENT = "create_incident"
ACTION_SEND_WEBHOOK = "send_webhook"
ACTION_SEND_SLACK_ALERT = "send_slack_alert"
ACTION_TRIGGER_PROCESSOR = "trigger_processor"
ACTION_ROLLBACK_DEPLOYMENT = "rollback_deployment"
ACTION_ENABLE_GUARDRAIL = "enable_guardrail"
ACTION_INCREASE_SAMPLING = "increase_sampling"
ACTION_DISABLE_PROCESSOR = "disable_processor"
ACTION_RECOMMEND_GUARDRAIL = "recommend_guardrail"


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


def _recent_action_count(db: Session, *, rule: AutomationRule, since: datetime) -> int:
    return int(
        db.scalar(
            select(func.count(ReliabilityActionLog.id)).where(
                ReliabilityActionLog.rule_id == rule.id,
                ReliabilityActionLog.created_at >= since,
                ReliabilityActionLog.status.in_([ACTION_STATUS_SUCCESS, ACTION_STATUS_DRY_RUN]),
            )
        )
        or 0
    )


def _latest_action(db: Session, *, rule: AutomationRule) -> ReliabilityActionLog | None:
    return db.scalar(
        select(ReliabilityActionLog)
        .where(
            ReliabilityActionLog.rule_id == rule.id,
            ReliabilityActionLog.status.in_([ACTION_STATUS_SUCCESS, ACTION_STATUS_DRY_RUN]),
        )
        .order_by(desc(ReliabilityActionLog.created_at), desc(ReliabilityActionLog.id))
    )


def _log_rule_skip(
    db: Session,
    *,
    rule: AutomationRule,
    status: str,
    target: str,
    event: EventMessage,
    detail: str,
) -> None:
    log_reliability_action(
        db,
        project_id=rule.project_id,
        rule_id=rule.id,
        action_type=rule.action_type,
        target=target,
        status=status,
        detail_json={"detail": detail, "event_type": event.event_type},
    )


def _mitigation_target(rule: AutomationRule, event: EventMessage) -> str:
    action_config = rule.action_config or {}
    if rule.action_type == ACTION_ROLLBACK_DEPLOYMENT:
        deployment_id = action_config.get("deployment_id") or event.payload.get("deployment_id")
        return f"deployment:{deployment_id}" if deployment_id else "deployment:auto"
    if rule.action_type == ACTION_ENABLE_GUARDRAIL:
        return f"guardrail:{action_config.get('policy_type', 'structured_output')}"
    if rule.action_type == ACTION_DISABLE_PROCESSOR:
        processor_id = action_config.get("processor_id")
        return f"processor:{processor_id}" if processor_id else "processor:missing"
    if rule.action_type == ACTION_INCREASE_SAMPLING:
        return f"trace_ingestion_policy:{rule.project_id}"
    return f"action:{rule.action_type}"


def _should_skip_for_safety(db: Session, *, rule: AutomationRule, event: EventMessage) -> bool:
    target = _mitigation_target(rule, event)
    if rule.cooldown_minutes > 0:
        latest = _latest_action(db, rule=rule)
        if latest is not None:
            boundary = _as_utc(latest.created_at) + timedelta(minutes=rule.cooldown_minutes)
            if boundary > _event_timestamp(event):
                _log_rule_skip(
                    db,
                    rule=rule,
                    status=ACTION_STATUS_SKIPPED_COOLDOWN,
                    target=target,
                    event=event,
                    detail=f"Action is cooling down until {boundary.isoformat()}",
                )
                return True
    if rule.max_actions_per_hour > 0:
        hourly_count = _recent_action_count(db, rule=rule, since=_event_timestamp(event) - timedelta(hours=1))
        if hourly_count >= rule.max_actions_per_hour:
            _log_rule_skip(
                db,
                rule=rule,
                status=ACTION_STATUS_SKIPPED_FREQUENCY,
                target=target,
                event=event,
                detail="Max actions per hour reached",
            )
            return True
    return False


def _execute_reliability_action(db: Session, *, rule: AutomationRule, project: Project, event: EventMessage) -> None:
    action_config = rule.action_config or {}
    if rule.action_type == ACTION_RECOMMEND_GUARDRAIL:
        policy_type = str(action_config.get("policy_type") or event.payload.get("recommended_guardrail") or "structured_output")
        log_reliability_action(
            db,
            project_id=project.id,
            rule_id=rule.id,
            action_type=ACTION_RECOMMEND_GUARDRAIL,
            target=f"guardrail:{policy_type}",
            status=ACTION_STATUS_SUCCESS if not rule.dry_run else ACTION_STATUS_DRY_RUN,
            detail_json={
                "rule_source": rule.rule_source,
                "graph_pattern_confidence": event.payload.get("graph_pattern_confidence"),
                "pattern": event.payload.get("pattern"),
            },
        )
        return
    if rule.action_type == ACTION_ROLLBACK_DEPLOYMENT:
        deployment_id = action_config.get("deployment_id") or event.payload.get("deployment_id")
        if deployment_id is None:
            deployment = most_recent_project_deployment(db, project_id=project.id, detected_at=_event_timestamp(event))
            if deployment is None:
                raise ValueError("rollback_deployment action could not resolve a deployment")
            deployment_id = deployment.id
        rollback_deployment(
            db,
            project_id=project.id,
            deployment_id=UUID(str(deployment_id)),
            rule_id=rule.id,
            dry_run=rule.dry_run,
            rollback_reason=str(action_config.get("rollback_reason", "Automated reliability rollback")),
        )
        return
    if rule.action_type == ACTION_ENABLE_GUARDRAIL:
        enable_guardrail(
            db,
            project_id=project.id,
            policy_type=str(action_config.get("policy_type", "structured_output")),
            rule_id=rule.id,
            dry_run=rule.dry_run,
        )
        return
    if rule.action_type == ACTION_INCREASE_SAMPLING:
        increase_sampling(
            db,
            project_id=project.id,
            rule_id=rule.id,
            dry_run=rule.dry_run,
        )
        return
    if rule.action_type == ACTION_DISABLE_PROCESSOR:
        processor_id = action_config.get("processor_id")
        if processor_id is None:
            raise ValueError("disable_processor action requires action_config.processor_id")
        disable_processor(
            db,
            project_id=project.id,
            processor_id=UUID(str(processor_id)),
            rule_id=rule.id,
            dry_run=rule.dry_run,
        )
        return
    raise ValueError(f"Unsupported reliability action '{rule.action_type}'")


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
        if rule.action_type in {
            ACTION_ROLLBACK_DEPLOYMENT,
            ACTION_ENABLE_GUARDRAIL,
            ACTION_INCREASE_SAMPLING,
            ACTION_DISABLE_PROCESSOR,
            ACTION_RECOMMEND_GUARDRAIL,
        } and _should_skip_for_safety(db, rule=rule, event=event):
            continue
        try:
            if rule.action_type == ACTION_CREATE_INCIDENT:
                _execute_create_incident(db, rule=rule, project=project, event=event)
            elif rule.action_type == ACTION_SEND_WEBHOOK:
                _execute_send_webhook(rule, event)
            elif rule.action_type == ACTION_SEND_SLACK_ALERT:
                _execute_send_slack_alert(db, rule=rule, project=project, event=event)
            elif rule.action_type == ACTION_TRIGGER_PROCESSOR:
                _execute_trigger_processor(rule, event)
            elif rule.action_type in {
                ACTION_ROLLBACK_DEPLOYMENT,
                ACTION_ENABLE_GUARDRAIL,
                ACTION_INCREASE_SAMPLING,
                ACTION_DISABLE_PROCESSOR,
                ACTION_RECOMMEND_GUARDRAIL,
            }:
                _execute_reliability_action(db, rule=rule, project=project, event=event)
            else:
                raise ValueError(f"Unsupported automation action '{rule.action_type}'")
        except Exception as exc:
            if rule.action_type in {
                ACTION_ROLLBACK_DEPLOYMENT,
                ACTION_ENABLE_GUARDRAIL,
                ACTION_INCREASE_SAMPLING,
                ACTION_DISABLE_PROCESSOR,
                ACTION_RECOMMEND_GUARDRAIL,
            }:
                log_reliability_action(
                    db,
                    project_id=project.id,
                    rule_id=rule.id,
                    action_type=rule.action_type,
                    target=_mitigation_target(rule, event),
                    status="error",
                    detail_json={"error": str(exc), "event_type": event.event_type},
                )
                continue
            raise
        triggered.append(rule)
    db.commit()
    for rule in triggered:
        publish_event(get_settings().event_stream_topic_traces, _trigger_record_payload(rule, event))
    return [str(rule.id) for rule in triggered]


def run_graph_intelligence_automation(db: Session, *, project_id: UUID) -> list[str]:
    project = db.get(Project, project_id)
    if project is None:
        return []
    recommendations = get_graph_guardrail_recommendations(
        db,
        organization_ids=[project.organization_id],
        project_id=project.id,
    )
    if not recommendations:
        return []
    from app.models.guardrail_policy import GuardrailPolicy

    active_guardrails = {
        policy.policy_type
        for policy in db.scalars(
            select(GuardrailPolicy).where(
                GuardrailPolicy.project_id == project.id,
                GuardrailPolicy.is_active.is_(True),
            )
        ).all()
    }
    triggered: list[str] = []
    now = datetime.now(timezone.utc)
    for recommendation in recommendations:
        if float(recommendation["confidence"]) < 0.8:
            continue
        if recommendation["policy_type"] in active_guardrails:
            continue
        event = EventMessage(
            topic=get_settings().event_stream_topic_traces,
            key=str(project.id),
            partition=0,
            event_type=RULE_SOURCE_GRAPH_INTELLIGENCE,
            payload={
                "project_id": str(project.id),
                "timestamp": now.isoformat(),
                "pattern": recommendation.get("pattern"),
                "graph_pattern_confidence": recommendation["confidence"],
                "guardrail_missing": True,
                "recommended_guardrail": recommendation["policy_type"],
            },
            offset=0,
            published_at=now,
        )
        triggered.extend(evaluate_automation_rules(db, event))
    return triggered
