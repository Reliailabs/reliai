from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from statistics import median
from typing import Any, Iterable
from urllib.parse import urlencode
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.core.settings import get_settings
from app.models.deployment_simulation import DeploymentSimulation
from app.models.alert_delivery import AlertDelivery
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.model_version import ModelVersion
from app.models.reliability_metric import ReliabilityMetric
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.models.prompt_version import PromptVersion
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.models.user import User
from app.services.custom_metrics import (
    custom_metric_rollup_name,
    list_enabled_project_custom_metrics,
)
from app.services.evaluations import (
    STRUCTURED_VALIDITY_EVAL_TYPE,
    trace_refusal_detected,
)
from app.services.deployments import most_recent_project_deployment
from app.services.environments import normalize_environment_name
from app.services.reliability_graph import sync_incident_root_causes
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window
from app.schemas.incident import IncidentListQuery
from app.services.auth import OperatorContext
from app.services.audit_log import log_action
from app.services.authorization import authorized_project_ids, require_project_access
from app.services.registry import build_model_version_path, build_prompt_version_path
from app.services.rollups import RollupScope, quantize_decimal

INCIDENT_WINDOW_MINUTES = 60

INCIDENT_EVENT_OPENED = "opened"
INCIDENT_EVENT_UPDATED = "updated"
INCIDENT_EVENT_ACKNOWLEDGED = "acknowledged"
INCIDENT_EVENT_OWNER_ASSIGNED = "owner_assigned"
INCIDENT_EVENT_OWNER_CLEARED = "owner_cleared"
INCIDENT_EVENT_RESOLVED = "resolved"
INCIDENT_EVENT_REOPENED = "reopened"
INCIDENT_EVENT_CONFIG_APPLIED = "config_applied"
INCIDENT_EVENT_CONFIG_UNDONE = "config_undone"
INCIDENT_EVENT_AI_SUMMARY_GENERATED = "ai_summary_generated"
INCIDENT_EVENT_AI_ROOT_CAUSE_EXPLANATION_GENERATED = "ai_root_cause_explanation_generated"
INCIDENT_EVENT_AI_TICKET_DRAFT_GENERATED = "ai_ticket_draft_generated"
TELEMETRY_FRESHNESS_INCIDENT_TYPE = "telemetry_freshness_stale"

_RESOLUTION_DISPLAY_NAMES: dict[str, str] = {
    "refusal_rate": "Refusal rate",
    "success_rate": "Success rate",
    "structured_output_validity_pass_rate": "Structured output validity",
    "p95_latency_ms": "P95 latency",
    "median_latency_ms": "Median latency",
    "average_cost_usd_per_trace": "Cost per trace",
}


def _resolution_display_name(metric_name: str, summary: dict[str, Any]) -> str:
    if metric_name in _RESOLUTION_DISPLAY_NAMES:
        return _RESOLUTION_DISPLAY_NAMES[metric_name]
    if metric_name.startswith("custom_metric."):
        stored = summary.get("custom_metric_name")
        if stored:
            return f"{stored} rate"
        key = metric_name.removeprefix("custom_metric.").removesuffix("_rate")
        return key.replace("_", " ").title() + " rate"
    return metric_name.replace("_", " ").replace(".", " ").title()


def _resolution_direction(metric_name: str) -> str:
    metric_name = metric_name.lower()
    if "success_rate" in metric_name or "validity" in metric_name:
        return "higher"
    if "latency" in metric_name or "cost" in metric_name:
        return "lower"
    if "refusal_rate" in metric_name or "error_rate" in metric_name:
        return "lower"
    if metric_name.startswith("custom_metric."):
        return "lower"
    return "lower"


def _format_resolution_value(value: float, unit: str | None) -> tuple[float, str]:
    if unit == "%":
        display = round(value * 100, 1)
        return display, f"{display}%"
    if unit == "ms":
        display = round(value)
        return display, f"{display}ms"
    display = round(value, 3)
    if unit:
        return display, f"{display}{unit}"
    return display, str(display)


def _format_resolution_display_value(value: float, unit: str | None) -> str:
    if unit == "%":
        return f"{value}%"
    if unit == "ms":
        return f"{value}ms"
    if unit:
        return f"{value}{unit}"
    return str(value)


def _resolution_metric_statement(
    *,
    incident: Incident,
    metric_name: str,
    scope_type: str,
    scope_id: str,
    window_minutes: int,
):
    return (
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == incident.project_id,
            ReliabilityMetric.metric_name == metric_name,
            ReliabilityMetric.scope_type == scope_type,
            ReliabilityMetric.scope_id == scope_id,
            ReliabilityMetric.window_minutes == window_minutes,
        )
        .order_by(desc(ReliabilityMetric.window_end), desc(ReliabilityMetric.created_at))
    )


def build_resolution_impact_baseline(
    db: Session,
    *,
    incident: Incident,
    action_time: datetime,
) -> dict[str, Any] | None:
    summary = incident.summary_json or {}
    metric_name = summary.get("metric_name")
    scope_type = summary.get("scope_type")
    scope_id = summary.get("scope_id")
    if not metric_name or not scope_type or not scope_id:
        return None
    window_minutes = int(summary.get("window_minutes") or INCIDENT_WINDOW_MINUTES)
    statement = _resolution_metric_statement(
        incident=incident,
        metric_name=str(metric_name),
        scope_type=str(scope_type),
        scope_id=str(scope_id),
        window_minutes=window_minutes,
    )
    before = db.scalar(statement.where(ReliabilityMetric.window_end <= action_time))
    display_name = _resolution_display_name(str(metric_name), summary)
    if before is None:
        summary_value = summary.get("current_value_number")
        unit = summary.get("metric_unit")
        if summary_value is None or unit is None:
            return None
        before_value, _ = _format_resolution_value(float(summary_value), str(unit))
        return {
            "metric_name": str(metric_name),
            "display_name": display_name,
            "before_value": before_value,
            "unit": str(unit),
            "status": "pending",
        }
    unit = before.unit
    before_value, _ = _format_resolution_value(before.value_number, unit)
    return {
        "metric_name": str(metric_name),
        "display_name": display_name,
        "before_value": before_value,
        "unit": unit,
        "status": "pending",
    }


def compute_resolution_impact(
    db: Session,
    *,
    incident: Incident,
    action_time: datetime,
    action_label: str,
    baseline: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    summary = incident.summary_json or {}
    metric_name = summary.get("metric_name")
    scope_type = summary.get("scope_type")
    scope_id = summary.get("scope_id")
    if not metric_name or not scope_type or not scope_id:
        return None
    window_minutes = int(summary.get("window_minutes") or INCIDENT_WINDOW_MINUTES)
    if baseline is None:
        baseline = build_resolution_impact_baseline(
            db,
            incident=incident,
            action_time=action_time,
        )
    if baseline is None:
        return None
    before_value = baseline.get("before_value")
    unit = baseline.get("unit")
    display_name = baseline.get("display_name") or _resolution_display_name(str(metric_name), summary)
    if before_value is None or unit is None:
        return None

    after_threshold = action_time + timedelta(minutes=window_minutes)
    statement = _resolution_metric_statement(
        incident=incident,
        metric_name=str(metric_name),
        scope_type=str(scope_type),
        scope_id=str(scope_id),
        window_minutes=window_minutes,
    )
    after = db.scalar(statement.where(ReliabilityMetric.window_end >= after_threshold))
    if after is None:
        source = str(summary.get("source") or "")
        baseline_value_number = summary.get("baseline_value_number")
        if source.startswith("onboarding_simulation") and baseline_value_number is not None:
            after_value, after_display = _format_resolution_value(float(baseline_value_number), unit)
            before_display = _format_resolution_display_value(before_value, unit)
            direction = _resolution_direction(str(metric_name))
            if direction == "higher":
                verb = "improved" if after_value > before_value else "declined"
            elif "latency" in str(metric_name).lower():
                verb = "improved" if after_value < before_value else "increased"
            else:
                verb = "dropped" if after_value < before_value else "increased"
            summary_text = f"{display_name} {verb} from {before_display} to {after_display} {action_label}"
            return {
                "metric_name": str(metric_name),
                "display_name": display_name,
                "before_value": before_value,
                "after_value": after_value,
                "delta": after_value - before_value,
                "unit": unit,
                "summary": summary_text,
                "status": "simulated",
            }
        return {
            **baseline,
            "status": "pending",
        }
    after_value, after_display = _format_resolution_value(after.value_number, unit)
    before_display = _format_resolution_display_value(before_value, unit)
    direction = _resolution_direction(str(metric_name))
    summary_text = None
    if direction == "higher":
        verb = "improved" if after_value > before_value else "declined"
    elif "latency" in str(metric_name).lower():
        verb = "improved" if after_value < before_value else "increased"
    else:
        verb = "dropped" if after_value < before_value else "increased"
    summary_text = f"{display_name} {verb} from {before_display} to {after_display} {action_label}"
    return {
        "metric_name": str(metric_name),
        "display_name": display_name,
        "before_value": before_value,
        "after_value": after_value,
        "delta": after_value - before_value,
        "unit": unit,
        "summary": summary_text,
        "status": "ready",
    }


@dataclass(frozen=True)
class IncidentRule:
    incident_type: str
    metric_name: str
    title_template: str
    minimum_sample_size: int
    comparator: str
    absolute_threshold: Decimal
    percent_threshold: Decimal | None


@dataclass
class IncidentSyncResult:
    opened_incidents: list[Incident] = field(default_factory=list)
    updated_incidents: list[Incident] = field(default_factory=list)
    resolved_incidents: list[Incident] = field(default_factory=list)
    reopened_incidents: list[Incident] = field(default_factory=list)


INCIDENT_RULES = (
    IncidentRule(
        incident_type="structured_output_validity_drop",
        metric_name="structured_output_validity_pass_rate",
        title_template="Structured output validity dropped",
        minimum_sample_size=5,
        comparator="drop",
        absolute_threshold=Decimal("0.20"),
        percent_threshold=None,
    ),
    IncidentRule(
        incident_type="success_rate_drop",
        metric_name="success_rate",
        title_template="Success rate dropped",
        minimum_sample_size=10,
        comparator="drop",
        absolute_threshold=Decimal("0.10"),
        percent_threshold=None,
    ),
    IncidentRule(
        incident_type="p95_latency_spike",
        metric_name="p95_latency_ms",
        title_template="P95 latency spiked",
        minimum_sample_size=10,
        comparator="spike",
        absolute_threshold=Decimal("250"),
        percent_threshold=Decimal("0.50"),
    ),
    IncidentRule(
        incident_type="average_cost_spike",
        metric_name="average_cost_usd_per_trace",
        title_template="Average cost per trace spiked",
        minimum_sample_size=10,
        comparator="spike",
        absolute_threshold=Decimal("0.010000"),
        percent_threshold=Decimal("0.40"),
    ),
    IncidentRule(
        incident_type="refusal_rate_spike",
        metric_name="refusal_rate",
        title_template="Refusal rate spiked",
        minimum_sample_size=10,
        comparator="spike",
        absolute_threshold=Decimal("0.15"),
        percent_threshold=Decimal("0.50"),
    ),
)

def _dev_incident_tuning(rule: IncidentRule) -> IncidentRule:
    settings = get_settings()
    if settings.app_env.lower() not in {"development", "dev", "local"}:
        return rule
    percent_threshold = (
        rule.percent_threshold * Decimal("0.2") if rule.percent_threshold is not None else None
    )
    return IncidentRule(
        incident_type=rule.incident_type,
        metric_name=rule.metric_name,
        title_template=rule.title_template,
        minimum_sample_size=1,
        comparator=rule.comparator,
        absolute_threshold=rule.absolute_threshold * Decimal("0.2"),
        percent_threshold=percent_threshold,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def telemetry_freshness_threshold_minutes() -> int:
    return get_settings().reliability_stale_telemetry_minutes


def _fingerprint(scope: RollupScope, rule: IncidentRule) -> str:
    return ":".join(
        [
            str(scope.organization_id),
            str(scope.project_id),
            scope.scope_type,
            scope.scope_id,
            rule.incident_type,
            str(INCIDENT_WINDOW_MINUTES),
        ]
    )


def _severity(rule: IncidentRule, snapshot: RegressionSnapshot) -> str:
    percent = abs(snapshot.delta_percent or Decimal("0"))
    absolute = abs(snapshot.delta_absolute)
    if rule.metric_name in {"structured_output_validity_pass_rate", "success_rate", "refusal_rate"} or rule.metric_name.startswith("custom_metric."):
        if absolute >= Decimal("0.30"):
            return "critical"
        if absolute >= Decimal("0.20"):
            return "high"
        return "medium"
    if percent >= Decimal("1.0") or absolute >= Decimal("1000"):
        return "critical"
    if percent >= Decimal("0.75") or absolute >= Decimal("500"):
        return "high"
    return "medium"


def _snapshot_breaches(rule: IncidentRule, snapshot: RegressionSnapshot) -> bool:
    rule = _dev_incident_tuning(rule)
    current_samples = (snapshot.metadata_json or {}).get("current_sample_size", 0)
    baseline_samples = (snapshot.metadata_json or {}).get("baseline_sample_size", 0)
    if current_samples < rule.minimum_sample_size or baseline_samples < rule.minimum_sample_size:
        return False
    absolute = abs(snapshot.delta_absolute)
    if rule.comparator == "drop" and snapshot.current_value >= snapshot.baseline_value:
        return False
    if rule.comparator == "spike" and snapshot.current_value <= snapshot.baseline_value:
        return False
    if absolute < rule.absolute_threshold:
        return False
    if rule.percent_threshold is not None and snapshot.baseline_value != 0:
        if abs(snapshot.delta_percent or Decimal("0")) < rule.percent_threshold:
            return False
    return True


def snapshot_breaches_any_rule(snapshot: RegressionSnapshot) -> bool:
    for rule in INCIDENT_RULES:
        if rule.metric_name == snapshot.metric_name and _snapshot_breaches(rule, snapshot):
            return True
    if snapshot.metric_name.startswith("custom_metric."):
        custom_rule = IncidentRule(
            incident_type="custom_metric_spike",
            metric_name=snapshot.metric_name,
            title_template="",
            minimum_sample_size=10,
            comparator="spike",
            absolute_threshold=Decimal("0.15"),
            percent_threshold=Decimal("0.50"),
        )
        return _snapshot_breaches(custom_rule, snapshot)
    return False


def _sample_traces(
    db: Session,
    scope: RollupScope,
    rule: IncidentRule,
    window_start: str,
    window_end: str,
) -> list[Trace]:
    statement = select(Trace).where(
        Trace.organization_id == scope.organization_id,
        Trace.project_id == scope.project_id,
        Trace.timestamp >= datetime.fromisoformat(window_start),
        Trace.timestamp < datetime.fromisoformat(window_end),
    )
    if scope.scope_type == "prompt_version":
        statement = statement.where(Trace.prompt_version == scope.scope_id)

    if rule.metric_name == "success_rate":
        statement = statement.order_by(Trace.success.asc(), desc(Trace.timestamp))
    elif rule.metric_name == "refusal_rate":
        statement = statement.order_by(desc(Trace.timestamp))
    elif rule.metric_name == "p95_latency_ms":
        statement = statement.order_by(desc(Trace.latency_ms), desc(Trace.timestamp))
    elif rule.metric_name == "average_cost_usd_per_trace":
        statement = statement.order_by(desc(Trace.total_cost_usd), desc(Trace.timestamp))
    else:
        statement = statement.order_by(desc(Trace.timestamp))
    rows = db.scalars(statement.limit(15)).all()
    if rule.metric_name != "refusal_rate":
        return rows[:5]

    refusal_sorted = sorted(
        rows,
        key=lambda trace: (1 if trace_refusal_detected(trace) else 0, trace.timestamp),
        reverse=True,
    )
    return refusal_sorted[:5]


def append_incident_event(
    db: Session,
    *,
    incident: Incident,
    event_type: str,
    actor_operator_user_id: UUID | None = None,
    metadata_json: dict[str, Any] | None = None,
    created_at: datetime | None = None,
) -> IncidentEvent:
    event = IncidentEvent(
        incident_id=incident.id,
        event_type=event_type,
        actor_operator_user_id=actor_operator_user_id,
        metadata_json=metadata_json,
        created_at=created_at or _now(),
    )
    db.add(event)
    db.flush()
    return event


def _incident_summary_json(
    *,
    scope: RollupScope,
    snapshot: RegressionSnapshot,
    sample_traces: list[Trace],
) -> dict[str, Any]:
    return {
        "metric_name": snapshot.metric_name,
        "current_value": str(snapshot.current_value),
        "baseline_value": str(snapshot.baseline_value),
        "delta_absolute": str(snapshot.delta_absolute),
        "delta_percent": str(snapshot.delta_percent) if snapshot.delta_percent is not None else None,
        "scope_type": snapshot.scope_type,
        "scope_id": snapshot.scope_id,
        "window_minutes": snapshot.window_minutes,
        "regression_snapshot_ids": [str(snapshot.id)],
        "sample_trace_ids": [str(trace.id) for trace in sample_traces],
        "current_window_start": (snapshot.metadata_json or {}).get("current_window_start"),
        "current_window_end": (snapshot.metadata_json or {}).get("current_window_end"),
        "baseline_window_start": (snapshot.metadata_json or {}).get("baseline_window_start"),
        "baseline_window_end": (snapshot.metadata_json or {}).get("baseline_window_end"),
    }


def _incident_event_metadata(
    *,
    scope: RollupScope,
    snapshot: RegressionSnapshot,
    severity: str,
) -> dict[str, Any]:
    metadata = snapshot.metadata_json or {}
    return {
        "incident_type": snapshot.metric_name,
        "metric_name": snapshot.metric_name,
        "scope_type": scope.scope_type,
        "scope_id": scope.scope_id,
        "current_value": str(snapshot.current_value),
        "baseline_value": str(snapshot.baseline_value),
        "delta_absolute": str(snapshot.delta_absolute),
        "delta_percent": str(snapshot.delta_percent) if snapshot.delta_percent is not None else None,
        "current_sample_size": metadata.get("current_sample_size"),
        "baseline_sample_size": metadata.get("baseline_sample_size"),
        "severity": severity,
        "window_minutes": snapshot.window_minutes,
    }


def _mark_resolved(
    db: Session,
    *,
    incident: Incident,
    resolved_at: datetime,
    actor_operator_user_id: UUID | None,
    reason: str,
) -> Incident:
    if incident.status == "resolved":
        return incident
    incident.status = "resolved"
    incident.updated_at = resolved_at
    incident.resolved_at = resolved_at
    db.add(incident)
    append_incident_event(
        db,
        incident=incident,
        event_type=INCIDENT_EVENT_RESOLVED,
        actor_operator_user_id=actor_operator_user_id,
        metadata_json={"reason": reason},
        created_at=resolved_at,
    )
    return incident


def _mark_reopened(
    db: Session,
    *,
    incident: Incident,
    reopened_at: datetime,
    actor_operator_user_id: UUID | None,
    reason: str,
) -> Incident:
    if incident.status == "open":
        return incident
    incident.status = "open"
    incident.started_at = reopened_at
    incident.updated_at = reopened_at
    incident.resolved_at = None
    incident.acknowledged_at = None
    incident.acknowledged_by_operator_user_id = None
    db.add(incident)
    append_incident_event(
        db,
        incident=incident,
        event_type=INCIDENT_EVENT_REOPENED,
        actor_operator_user_id=actor_operator_user_id,
        metadata_json={"reason": reason},
        created_at=reopened_at,
    )
    return incident


def _sync_single_rule(
    db: Session,
    *,
    scope: RollupScope,
    project: Project,
    rule: IncidentRule,
    snapshot: RegressionSnapshot,
    detected_at: datetime,
    result: IncidentSyncResult,
    extra_summary_fields: dict[str, Any] | None = None,
) -> None:
    fingerprint = _fingerprint(scope, rule)
    incident = db.scalar(select(Incident).where(Incident.fingerprint == fingerprint))
    breaches = _snapshot_breaches(rule, snapshot)

    if not breaches:
        if incident is not None and incident.status == "open":
            _mark_resolved(
                db,
                incident=incident,
                resolved_at=detected_at,
                actor_operator_user_id=None,
                reason="threshold_recovered",
            )
            result.resolved_incidents.append(incident)
        return

    metadata = snapshot.metadata_json or {}
    sample_traces = _sample_traces(
        db,
        scope,
        rule,
        metadata["current_window_start"],
        metadata["current_window_end"],
    )
    severity = _severity(rule, snapshot)
    summary_json = _incident_summary_json(scope=scope, snapshot=snapshot, sample_traces=sample_traces)
    if extra_summary_fields:
        summary_json.update(extra_summary_fields)
    event_metadata = _incident_event_metadata(scope=scope, snapshot=snapshot, severity=severity)

    if incident is None:
        deployment = most_recent_project_deployment(
            db,
            project_id=scope.project_id,
            detected_at=detected_at,
        )
        incident = Incident(
            organization_id=scope.organization_id,
            project_id=scope.project_id,
            deployment_id=deployment.id if deployment is not None else None,
            incident_type=rule.incident_type,
            fingerprint=fingerprint,
            started_at=detected_at,
            updated_at=detected_at,
            status="open",
            severity=severity,
            title="",
            summary_json=summary_json,
        )
        db.add(incident)
        db.flush()
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_OPENED,
            metadata_json={**event_metadata, "reason": "threshold_breached"},
            created_at=detected_at,
        )
        result.opened_incidents.append(incident)
    elif incident.status != "open":
        # Deterministic reopen rule:
        # A resolved incident is reopened in place when the same fingerprint breaches again.
        # Fingerprint is org + project + scope + incident_type + incident window, so operators
        # get one explainable lifecycle per recurring regression instead of duplicate incidents.
        _mark_reopened(
            db,
            incident=incident,
            reopened_at=detected_at,
            actor_operator_user_id=None,
            reason="threshold_breached_again",
        )
        result.reopened_incidents.append(incident)
        deployment = most_recent_project_deployment(
            db,
            project_id=scope.project_id,
            detected_at=detected_at,
        )
        incident.deployment_id = deployment.id if deployment is not None else None
    else:
        incident.updated_at = detected_at
        db.add(incident)
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_UPDATED,
            metadata_json=event_metadata,
            created_at=detected_at,
        )
        result.updated_incidents.append(incident)

    incident.severity = severity
    incident.title = (
        f"{rule.title_template} on {project.name}"
        if scope.scope_type == "project"
        else f"{rule.title_template} on {project.name} ({scope.scope_id})"
    )
    incident.summary_json = summary_json
    incident.updated_at = detected_at
    incident.resolved_at = None
    db.add(incident)
    db.flush()
    sync_incident_root_causes(db, incident=incident)


def sync_incidents_for_scope(
    db: Session,
    *,
    scope: RollupScope,
    project: Project,
    regressions: Iterable[RegressionSnapshot],
    detected_at: datetime,
) -> IncidentSyncResult:
    snapshot_by_metric = {snapshot.metric_name: snapshot for snapshot in regressions}
    result = IncidentSyncResult()

    for rule in INCIDENT_RULES:
        snapshot = snapshot_by_metric.get(rule.metric_name)
        if snapshot is None:
            continue
        _sync_single_rule(
            db,
            scope=scope,
            project=project,
            rule=rule,
            snapshot=snapshot,
            detected_at=detected_at,
            result=result,
        )

    custom_metrics = list_enabled_project_custom_metrics(db, project_id=scope.project_id)
    for metric in custom_metrics:
        snapshot = snapshot_by_metric.get(custom_metric_rollup_name(metric))
        if snapshot is None:
            continue
        rule = IncidentRule(
            incident_type=f"custom_metric_spike:{metric.metric_key}",
            metric_name=custom_metric_rollup_name(metric),
            title_template=f"{metric.name} rate increased",
            minimum_sample_size=10,
            comparator="spike",
            absolute_threshold=Decimal("0.15"),
            percent_threshold=Decimal("0.50"),
        )
        _sync_single_rule(
            db,
            scope=scope,
            project=project,
            rule=rule,
            snapshot=snapshot,
            detected_at=detected_at,
            result=result,
            extra_summary_fields={
                "custom_metric_key": metric.metric_key,
                "custom_metric_name": metric.name,
            },
        )

    return result


def _telemetry_freshness_fingerprint(project: Project) -> str:
    return ":".join(
        [
            str(project.organization_id),
            str(project.id),
            "project",
            str(project.id),
            TELEMETRY_FRESHNESS_INCIDENT_TYPE,
        ]
    )


def _telemetry_freshness_severity(freshness_minutes: float) -> str:
    if freshness_minutes >= 240:
        return "critical"
    if freshness_minutes >= 60:
        return "high"
    return "medium"


def sync_telemetry_freshness_incident(
    db: Session,
    *,
    project: Project,
    freshness_minutes: float | None,
    detected_at: datetime,
) -> IncidentSyncResult:
    result = IncidentSyncResult()
    threshold_minutes = telemetry_freshness_threshold_minutes()
    incident = db.scalar(
        select(Incident).where(Incident.fingerprint == _telemetry_freshness_fingerprint(project))
    )
    is_stale = freshness_minutes is not None and freshness_minutes > threshold_minutes

    if not is_stale:
        if incident is not None and incident.status == "open":
            _mark_resolved(
                db,
                incident=incident,
                resolved_at=detected_at,
                actor_operator_user_id=None,
                reason="telemetry_restored",
            )
            result.resolved_incidents.append(incident)
        return result

    severity = _telemetry_freshness_severity(freshness_minutes)
    summary_json = {
        "metric_name": "telemetry_freshness_minutes",
        "current_value": freshness_minutes,
        "baseline_value": threshold_minutes,
        "delta_absolute": freshness_minutes - threshold_minutes,
        "delta_percent": None,
        "scope_type": "project",
        "scope_id": str(project.id),
        "window_minutes": threshold_minutes,
        "sample_trace_ids": [],
    }
    event_metadata = {
        "incident_type": TELEMETRY_FRESHNESS_INCIDENT_TYPE,
        "metric_name": "telemetry_freshness_minutes",
        "scope_type": "project",
        "scope_id": str(project.id),
        "current_value": freshness_minutes,
        "baseline_value": threshold_minutes,
        "severity": severity,
        "window_minutes": threshold_minutes,
    }

    if incident is None:
        deployment = most_recent_project_deployment(
            db,
            project_id=project.id,
            detected_at=detected_at,
        )
        incident = Incident(
            organization_id=project.organization_id,
            project_id=project.id,
            deployment_id=deployment.id if deployment is not None else None,
            incident_type=TELEMETRY_FRESHNESS_INCIDENT_TYPE,
            fingerprint=_telemetry_freshness_fingerprint(project),
            started_at=detected_at,
            updated_at=detected_at,
            status="open",
            severity=severity,
            title="",
            summary_json=summary_json,
        )
        db.add(incident)
        db.flush()
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_OPENED,
            metadata_json={**event_metadata, "reason": "telemetry_stale"},
            created_at=detected_at,
        )
        result.opened_incidents.append(incident)
    elif incident.status != "open":
        _mark_reopened(
            db,
            incident=incident,
            reopened_at=detected_at,
            actor_operator_user_id=None,
            reason="telemetry_stale_again",
        )
        result.reopened_incidents.append(incident)
        deployment = most_recent_project_deployment(
            db,
            project_id=project.id,
            detected_at=detected_at,
        )
        incident.deployment_id = deployment.id if deployment is not None else None
    else:
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_UPDATED,
            metadata_json=event_metadata,
            created_at=detected_at,
        )
        result.updated_incidents.append(incident)

    incident.severity = severity
    incident.title = f"Telemetry is stale on {project.name}"
    incident.summary_json = summary_json
    incident.updated_at = detected_at
    incident.resolved_at = None
    db.add(incident)
    db.flush()
    return result


def _latest_alert_delivery(db: Session, incident_id: UUID) -> AlertDelivery | None:
    return db.scalar(
        select(AlertDelivery)
        .where(AlertDelivery.incident_id == incident_id)
        .order_by(desc(AlertDelivery.created_at), desc(AlertDelivery.id))
    )


def list_incidents(db: Session, operator: OperatorContext, query: IncidentListQuery) -> list[Incident]:
    if query.project_id is not None:
        require_project_access(db, operator, query.project_id)
        allowed_project_ids = [query.project_id]
    else:
        allowed_project_ids = authorized_project_ids(db, operator)

    statement = (
        select(Incident)
        .options(
            joinedload(Incident.project),
            joinedload(Incident.acknowledged_by_operator),
            joinedload(Incident.owner_operator),
        )
        .where(Incident.project_id.in_(allowed_project_ids))
        .order_by(desc(Incident.started_at), desc(Incident.updated_at))
    )
    if query.project_id is not None:
        statement = statement.where(Incident.project_id == query.project_id)
    if query.environment is not None:
        statement = statement.where(
            Incident.environment_ref.has(name=normalize_environment_name(query.environment))
        )
    if query.status is not None:
        statement = statement.where(Incident.status == query.status)
    if query.severity is not None:
        statement = statement.where(Incident.severity == query.severity)
    if query.owner_operator_user_id is not None:
        statement = statement.where(Incident.owner_operator_user_id == query.owner_operator_user_id)
    if query.owner_state == "assigned":
        statement = statement.where(Incident.owner_operator_user_id.is_not(None))
    if query.owner_state == "unassigned":
        statement = statement.where(Incident.owner_operator_user_id.is_(None))
    if query.date_from is not None:
        statement = statement.where(
            Incident.started_at >= datetime.combine(query.date_from, time.min, tzinfo=timezone.utc)
        )
    if query.date_to is not None:
        statement = statement.where(
            Incident.started_at <= datetime.combine(query.date_to, time.max, tzinfo=timezone.utc)
        )

    incidents = db.scalars(statement).unique().all()
    if query.scope_type is not None:
        incidents = [
            incident
            for incident in incidents
            if incident.summary_json.get("scope_type") == query.scope_type
        ]
    if query.scope_id is not None:
        incidents = [
            incident
            for incident in incidents
            if incident.summary_json.get("scope_id") == query.scope_id
        ]
    incidents = incidents[: query.limit]
    for incident in incidents:
        incident.latest_alert_delivery = _latest_alert_delivery(db, incident.id)
    return incidents


def get_incident_detail(db: Session, operator: OperatorContext, incident_id: UUID) -> Incident:
    allowed_project_ids = authorized_project_ids(db, operator)
    if not allowed_project_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    incident = db.scalar(
        select(Incident)
        .options(
            joinedload(Incident.project),
            joinedload(Incident.acknowledged_by_operator),
            joinedload(Incident.owner_operator),
        )
        .where(
            Incident.id == incident_id,
            Incident.project_id.in_(allowed_project_ids),
        )
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    incident.latest_alert_delivery = _latest_alert_delivery(db, incident.id)
    return incident


def get_incident_regressions(db: Session, incident: Incident) -> list[RegressionSnapshot]:
    snapshot_ids = [
        UUID(snapshot_id)
        for snapshot_id in incident.summary_json.get("regression_snapshot_ids", [])
    ]
    if not snapshot_ids:
        return []
    statement = select(RegressionSnapshot).where(
        RegressionSnapshot.id.in_(snapshot_ids), RegressionSnapshot.project_id == incident.project_id
    )
    return db.scalars(statement).all()


def get_incident_traces(db: Session, incident: Incident) -> list[Trace]:
    trace_ids = [UUID(trace_id) for trace_id in incident.summary_json.get("sample_trace_ids", [])]
    if not trace_ids:
        return []
    statement = select(Trace).where(
        Trace.id.in_(trace_ids),
        Trace.project_id == incident.project_id,
        Trace.organization_id == incident.organization_id,
    )
    return db.scalars(statement).all()


def get_incident_rule(incident_type: str) -> IncidentRule | None:
    for rule in INCIDENT_RULES:
        if rule.incident_type == incident_type:
            return rule
    if incident_type.startswith("custom_metric_spike"):
        metric_key = incident_type.removeprefix("custom_metric_spike:") or "custom_metric"
        return IncidentRule(
            incident_type=incident_type,
            metric_name=f"custom_metric.{metric_key}_rate",
            title_template=f"{metric_key.replace('_', ' ').title()} rate increased",
            minimum_sample_size=10,
            comparator="spike",
            absolute_threshold=Decimal("0.10"),
            percent_threshold=Decimal("0.50"),
        )
    return None


def get_incident_representative_traces(db: Session, incident: Incident) -> list[Trace]:
    current_traces, _ = get_incident_compare_traces(db, incident)
    return current_traces[:5]


def _window_value(summary: dict[str, Any], key: str) -> datetime | None:
    value = summary.get(key)
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _load_window_traces(
    db: Session,
    *,
    incident: Incident,
    window_start_key: str,
    window_end_key: str,
    with_details: bool = False,
) -> list[Trace]:
    summary = incident.summary_json or {}
    window_start = _window_value(summary, window_start_key)
    window_end = _window_value(summary, window_end_key)
    if window_start is None or window_end is None:
        return []
    return query_trace_window(
        db,
        TraceWindowQuery(
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            environment_id=incident.environment_id,
            window_start=window_start,
            window_end=window_end,
            prompt_version=summary.get("scope_id") if summary.get("scope_type") == "prompt_version" else None,
            with_details=with_details,
        ),
    )


def _structured_output_label(trace: Trace) -> str | None:
    for evaluation in getattr(trace, "evaluations", []):
        if evaluation.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE:
            return evaluation.label
    return None


def _structured_output_reason(trace: Trace) -> str | None:
    for evaluation in getattr(trace, "evaluations", []):
        if evaluation.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE:
            raw = evaluation.raw_result_json or {}
            reason = raw.get("reason")
            return str(reason) if reason is not None else None
    return None


def _selected_metadata(trace: Trace) -> dict[str, Any] | None:
    metadata = trace.metadata_json or {}
    excerpt: dict[str, Any] = {}
    for key in sorted(metadata.keys()):
        if key in {"structured_output_schema", "retrieved_chunks_json"}:
            continue
        value = metadata[key]
        if isinstance(value, (str, int, float, bool)) or value is None:
            excerpt[key] = value
        if len(excerpt) >= 6:
            break
    return excerpt or None


def _prompt_version_record_item(trace: Trace) -> dict[str, Any] | None:
    record = trace.prompt_version_record
    if record is None:
        return None
    return {
        "id": record.id,
        "project_id": record.project_id,
        "version": record.version,
        "label": record.label,
        "notes": record.notes,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _model_version_record_item(trace: Trace) -> dict[str, Any] | None:
    record = trace.model_version_record
    if record is None:
        return None
    return {
        "id": record.id,
        "project_id": record.project_id,
        "provider": record.provider,
        "model_name": record.model_name,
        "model_version": record.model_version,
        "model_family": record.model_family,
        "model_revision": record.model_revision,
        "route_key": record.route_key,
        "label": record.label,
        "identity_key": record.identity_key,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _coerce_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _trace_sort_key(trace: Trace, *, incident_type: str, window_kind: str) -> tuple:
    structured_label = _structured_output_label(trace)
    failure_priority = 1 if not trace.success else 0
    structured_failure_priority = 1 if structured_label == "fail" else 0
    success_priority = 1 if trace.success else 0
    structured_pass_priority = 1 if structured_label == "pass" else 0
    latency = trace.latency_ms or 0
    cost = trace.total_cost_usd or Decimal("0")

    if incident_type == "structured_output_validity_drop":
        if window_kind == "current":
            return (structured_failure_priority, failure_priority, trace.timestamp)
        return (structured_pass_priority, success_priority, trace.timestamp)
    if incident_type == "success_rate_drop":
        if window_kind == "current":
            return (failure_priority, trace.timestamp)
        return (success_priority, trace.timestamp)
    if incident_type == "p95_latency_spike":
        return (latency, trace.timestamp)
    if incident_type == "average_cost_spike":
        return (cost, trace.timestamp)
    return (trace.timestamp,)


def _select_representative_traces(
    traces: list[Trace],
    *,
    incident: Incident,
    window_kind: str,
    limit: int = 5,
) -> list[Trace]:
    if not traces:
        return []
    ranked = sorted(
        traces,
        key=lambda trace: _trace_sort_key(trace, incident_type=incident.incident_type, window_kind=window_kind),
        reverse=True,
    )
    selected: list[Trace] = []
    seen: set[UUID] = set()
    for trace in ranked:
        if trace.id in seen:
            continue
        selected.append(trace)
        seen.add(trace.id)
        if len(selected) >= min(3, limit):
            break

    near_anchor = sorted(
        traces,
        key=lambda trace: abs(
            (_coerce_utc_datetime(trace.timestamp) - _coerce_utc_datetime(incident.started_at)).total_seconds()
        ),
    )
    for trace in near_anchor:
        if trace.id in seen:
            continue
        selected.append(trace)
        seen.add(trace.id)
        if len(selected) >= limit:
            break
    return selected[:limit]


def get_incident_compare_traces(db: Session, incident: Incident) -> tuple[list[Trace], list[Trace]]:
    current_window_traces = _load_window_traces(
        db,
        incident=incident,
        window_start_key="current_window_start",
        window_end_key="current_window_end",
        with_details=True,
    )
    baseline_window_traces = _load_window_traces(
        db,
        incident=incident,
        window_start_key="baseline_window_start",
        window_end_key="baseline_window_end",
        with_details=True,
    )
    return (
        _select_representative_traces(current_window_traces, incident=incident, window_kind="current"),
        _select_representative_traces(baseline_window_traces, incident=incident, window_kind="baseline"),
    )


def get_incident_window_traces(db: Session, incident: Incident) -> tuple[list[Trace], list[Trace]]:
    current_window_traces = _load_window_traces(
        db,
        incident=incident,
        window_start_key="current_window_start",
        window_end_key="current_window_end",
        with_details=True,
    )
    baseline_window_traces = _load_window_traces(
        db,
        incident=incident,
        window_start_key="baseline_window_start",
        window_end_key="baseline_window_end",
        with_details=True,
    )
    return current_window_traces, baseline_window_traces


def _share(counter: Counter[str], total: int, key: str) -> Decimal | None:
    if total == 0:
        return None
    return quantize_decimal(Decimal(counter.get(key, 0)) / Decimal(total))


def _dominant_value(traces: list[Trace], attribute: str) -> tuple[str | None, Counter[str]]:
    values = [getattr(trace, attribute) or "unknown" for trace in traces]
    counter = Counter(values)
    if not counter:
        return None, counter
    return counter.most_common(1)[0][0], counter


def _median_int(values: list[int]) -> Decimal | None:
    if not values:
        return None
    return quantize_decimal(Decimal(str(median(values))))


def _top_trace_ids(traces: list[Trace], *, limit: int = 3) -> list[UUID]:
    return [trace.id for trace in traces[:limit]]


def _decimal_string(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


def _stringify_scalar(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return _decimal_string(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _metadata_diff(current_value: dict[str, Any] | None, baseline_value: dict[str, Any] | None) -> dict[str, Any] | None:
    current = current_value or {}
    baseline = baseline_value or {}
    keys = sorted(set(current.keys()) | set(baseline.keys()))
    changes: dict[str, Any] = {}
    for key in keys:
        if current.get(key) == baseline.get(key):
            continue
        changes[key] = {
            "current": _stringify_scalar(current.get(key)),
            "baseline": _stringify_scalar(baseline.get(key)),
        }
        if len(changes) >= 6:
            break
    return changes or None


def _trace_cost_string(trace: Trace | None) -> str:
    if trace is None or trace.total_cost_usd is None:
        return "n/a"
    return _decimal_string(trace.total_cost_usd) or "n/a"


def _trace_outcome_string(trace: Trace | None) -> str | None:
    if trace is None:
        return None
    if trace.success:
        return "success"
    return trace.error_type or "failure"


def _structured_output_summary(trace: Trace | None) -> str | None:
    if trace is None:
        return None
    label = _structured_output_label(trace)
    reason = _structured_output_reason(trace)
    if label is None and reason is None:
        return None
    if reason is None:
        return label
    return f"{label or 'n/a'} · {reason}"


def build_trace_diff_blocks(current_trace: Trace | None, baseline_trace: Trace | None) -> list[dict[str, Any]]:
    current_metadata = _selected_metadata(current_trace) if current_trace is not None else None
    baseline_metadata = _selected_metadata(baseline_trace) if baseline_trace is not None else None
    current_retrieval = current_trace.retrieval_span if current_trace is not None else None
    baseline_retrieval = baseline_trace.retrieval_span if baseline_trace is not None else None
    blocks = [
        {
            "block_type": "model_prompt",
            "title": "Model and prompt",
            "changed": (
                (current_trace.model_name if current_trace else None) != (baseline_trace.model_name if baseline_trace else None)
                or (current_trace.prompt_version if current_trace else None) != (baseline_trace.prompt_version if baseline_trace else None)
            ),
            "current_value": (
                f"{current_trace.model_name} · {current_trace.prompt_version or 'prompt n/a'}"
                if current_trace is not None
                else None
            ),
            "baseline_value": (
                f"{baseline_trace.model_name} · {baseline_trace.prompt_version or 'prompt n/a'}"
                if baseline_trace is not None
                else None
            ),
            "metadata_json": None,
        },
        {
            "block_type": "outcome",
            "title": "Success and error type",
            "changed": (
                (current_trace.success if current_trace else None) != (baseline_trace.success if baseline_trace else None)
                or (current_trace.error_type if current_trace else None) != (baseline_trace.error_type if baseline_trace else None)
            ),
            "current_value": (
                _trace_outcome_string(current_trace)
            ),
            "baseline_value": (
                _trace_outcome_string(baseline_trace)
            ),
            "metadata_json": None,
        },
        {
            "block_type": "performance",
            "title": "Latency, tokens, cost",
            "changed": any(
                [
                    (current_trace.latency_ms if current_trace else None) != (baseline_trace.latency_ms if baseline_trace else None),
                    (current_trace.prompt_tokens if current_trace else None) != (baseline_trace.prompt_tokens if baseline_trace else None),
                    (current_trace.completion_tokens if current_trace else None) != (baseline_trace.completion_tokens if baseline_trace else None),
                    (current_trace.total_cost_usd if current_trace else None) != (baseline_trace.total_cost_usd if baseline_trace else None),
                ]
            ),
            "current_value": (
                f"{current_trace.latency_ms if current_trace and current_trace.latency_ms is not None else 'n/a'} ms · "
                f"p {current_trace.prompt_tokens if current_trace and current_trace.prompt_tokens is not None else 'n/a'} · "
                f"c {current_trace.completion_tokens if current_trace and current_trace.completion_tokens is not None else 'n/a'} · "
                f"{_trace_cost_string(current_trace)}"
                if current_trace is not None
                else None
            ),
            "baseline_value": (
                f"{baseline_trace.latency_ms if baseline_trace and baseline_trace.latency_ms is not None else 'n/a'} ms · "
                f"p {baseline_trace.prompt_tokens if baseline_trace and baseline_trace.prompt_tokens is not None else 'n/a'} · "
                f"c {baseline_trace.completion_tokens if baseline_trace and baseline_trace.completion_tokens is not None else 'n/a'} · "
                f"{_trace_cost_string(baseline_trace)}"
                if baseline_trace is not None
                else None
            ),
            "metadata_json": None,
        },
        {
            "block_type": "structured_output",
            "title": "Structured-output evaluation",
            "changed": _structured_output_summary(current_trace) != _structured_output_summary(baseline_trace),
            "current_value": _structured_output_summary(current_trace),
            "baseline_value": _structured_output_summary(baseline_trace),
            "metadata_json": None,
        },
        {
            "block_type": "retrieval",
            "title": "Retrieval summary",
            "changed": any(
                [
                    (current_retrieval.retrieval_latency_ms if current_retrieval else None)
                    != (baseline_retrieval.retrieval_latency_ms if baseline_retrieval else None),
                    (current_retrieval.source_count if current_retrieval else None)
                    != (baseline_retrieval.source_count if baseline_retrieval else None),
                    (current_retrieval.top_k if current_retrieval else None)
                    != (baseline_retrieval.top_k if baseline_retrieval else None),
                ]
            ),
            "current_value": (
                f"{current_retrieval.retrieval_latency_ms if current_retrieval and current_retrieval.retrieval_latency_ms is not None else 'n/a'} ms · "
                f"{current_retrieval.source_count if current_retrieval and current_retrieval.source_count is not None else 'n/a'} sources · "
                f"top_k {current_retrieval.top_k if current_retrieval and current_retrieval.top_k is not None else 'n/a'}"
                if current_retrieval is not None
                else None
            ),
            "baseline_value": (
                f"{baseline_retrieval.retrieval_latency_ms if baseline_retrieval and baseline_retrieval.retrieval_latency_ms is not None else 'n/a'} ms · "
                f"{baseline_retrieval.source_count if baseline_retrieval and baseline_retrieval.source_count is not None else 'n/a'} sources · "
                f"top_k {baseline_retrieval.top_k if baseline_retrieval and baseline_retrieval.top_k is not None else 'n/a'}"
                if baseline_retrieval is not None
                else None
            ),
            "metadata_json": None,
        },
        {
            "block_type": "metadata_scalar",
            "title": "Metadata excerpt",
            "changed": current_metadata != baseline_metadata,
            "current_value": None,
            "baseline_value": None,
            "metadata_json": _metadata_diff(current_metadata, baseline_metadata),
        },
    ]
    return blocks


def derive_dimension_summaries(
    *,
    current_traces: list[Trace],
    baseline_traces: list[Trace],
) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []

    for dimension in ("prompt_version", "model_name"):
        current_value, current_counter = _dominant_value(current_traces, dimension)
        baseline_value, baseline_counter = _dominant_value(baseline_traces, dimension)
        if current_value is None:
            continue
        current_share = _share(current_counter, len(current_traces), current_value)
        baseline_share = _share(baseline_counter, len(baseline_traces), current_value)
        summaries.append(
            {
                "summary_type": f"top_{dimension}",
                "dimension": dimension,
                "current_value": None if current_value == "unknown" else current_value,
                "baseline_value": None if baseline_value == "unknown" else baseline_value,
                "current_count": current_counter.get(current_value, 0),
                "baseline_count": baseline_counter.get(current_value, 0),
                "current_share": current_share,
                "baseline_share": baseline_share,
                "delta_value": (
                    quantize_decimal(current_share - baseline_share)
                    if current_share is not None and baseline_share is not None
                    else None
                ),
                "metadata_json": None,
            }
        )

    current_retrieval = [
        trace.retrieval_span.retrieval_latency_ms
        for trace in current_traces
        if trace.retrieval_span is not None and trace.retrieval_span.retrieval_latency_ms is not None
    ]
    baseline_retrieval = [
        trace.retrieval_span.retrieval_latency_ms
        for trace in baseline_traces
        if trace.retrieval_span is not None and trace.retrieval_span.retrieval_latency_ms is not None
    ]
    current_retrieval_median = _median_int(current_retrieval)
    baseline_retrieval_median = _median_int(baseline_retrieval)
    if current_retrieval_median is not None or baseline_retrieval_median is not None:
        summaries.append(
            {
                "summary_type": "retrieval_latency_delta",
                "dimension": "retrieval_latency_ms",
                "current_value": None,
                "baseline_value": None,
                "current_count": len(current_retrieval),
                "baseline_count": len(baseline_retrieval),
                "current_share": None,
                "baseline_share": None,
                "delta_value": (
                    quantize_decimal(current_retrieval_median - baseline_retrieval_median)
                    if current_retrieval_median is not None and baseline_retrieval_median is not None
                    else None
                ),
                "metadata_json": {
                    "current_median_ms": _decimal_string(current_retrieval_median),
                    "baseline_median_ms": _decimal_string(baseline_retrieval_median),
                },
            }
        )

    current_structured_failures = [
        trace for trace in current_traces if _structured_output_label(trace) == "fail"
    ]
    baseline_structured_failures = [
        trace for trace in baseline_traces if _structured_output_label(trace) == "fail"
    ]
    summaries.append(
        {
            "summary_type": "structured_output_failure_concentration",
            "dimension": "structured_output",
            "current_value": "fail",
            "baseline_value": "fail",
            "current_count": len(current_structured_failures),
            "baseline_count": len(baseline_structured_failures),
            "current_share": _share(Counter({"fail": len(current_structured_failures)}), len(current_traces), "fail"),
            "baseline_share": _share(Counter({"fail": len(baseline_structured_failures)}), len(baseline_traces), "fail"),
            "delta_value": None,
            "metadata_json": None,
        }
    )
    return summaries


def _query_path(query_params: dict[str, str]) -> str:
    return f"/traces?{urlencode(query_params)}"


def build_cohort_pivots(
    *,
    project_id: UUID,
    scope_type: str | None,
    scope_id: str | None,
    current_window_start: datetime | None,
    current_window_end: datetime | None,
    anchor_time: datetime | None,
    current_traces: list[Trace],
) -> list[dict[str, Any]]:
    pivots: list[dict[str, Any]] = []
    base_query = {"project_id": str(project_id)}
    if current_window_start is not None:
        base_query["date_from"] = current_window_start.isoformat()
    if current_window_end is not None:
        base_query["date_to"] = current_window_end.isoformat()

    if scope_type == "prompt_version" and scope_id:
        query_params = {**base_query, "prompt_version": scope_id}
        pivots.append(
            {
                "pivot_type": "prompt_version_scope",
                "label": f"Trace cohort for prompt {scope_id}",
                "path": _query_path(query_params),
                "query_params": query_params,
            }
        )

    current_prompt, _ = _dominant_value(current_traces, "prompt_version")
    if current_prompt is not None and current_prompt != "unknown":
        query_params = {**base_query, "prompt_version": current_prompt}
        pivots.append(
            {
                "pivot_type": "top_prompt_version",
                "label": f"Traces for prompt {current_prompt}",
                "path": _query_path(query_params),
                "query_params": query_params,
            }
        )

    current_model, _ = _dominant_value(current_traces, "model_name")
    if current_model is not None and current_model != "unknown":
        query_params = {**base_query, "model_name": current_model}
        pivots.append(
            {
                "pivot_type": "top_model_name",
                "label": f"Traces for model {current_model}",
                "path": _query_path(query_params),
                "query_params": query_params,
            }
        )

    failing_query = {**base_query, "success": "false"}
    pivots.append(
        {
            "pivot_type": "failing_current_window",
            "label": "Failing traces in current window",
            "path": _query_path(failing_query),
            "query_params": failing_query,
        }
    )

    if anchor_time is not None:
        around_query = {"project_id": str(project_id)}
        around_query["date_from"] = (anchor_time - timedelta(minutes=10)).isoformat()
        around_query["date_to"] = (anchor_time + timedelta(minutes=10)).isoformat()
        pivots.append(
            {
                "pivot_type": "around_start_time",
                "label": "Traces around start time",
                "path": _query_path(around_query),
                "query_params": around_query,
            }
        )

    return pivots


def derive_registry_contexts(
    *,
    project_id: UUID,
    current_traces: list[Trace],
    baseline_traces: list[Trace],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    prompt_records: dict[UUID, PromptVersion] = {}
    prompt_current: Counter[UUID] = Counter()
    prompt_baseline: Counter[UUID] = Counter()
    model_records: dict[UUID, ModelVersion] = {}
    model_current: Counter[UUID] = Counter()
    model_baseline: Counter[UUID] = Counter()

    for trace in current_traces:
        if trace.prompt_version_record is not None:
            prompt_records[trace.prompt_version_record.id] = trace.prompt_version_record
            prompt_current[trace.prompt_version_record.id] += 1
        if trace.model_version_record is not None:
            model_records[trace.model_version_record.id] = trace.model_version_record
            model_current[trace.model_version_record.id] += 1

    for trace in baseline_traces:
        if trace.prompt_version_record is not None:
            prompt_records[trace.prompt_version_record.id] = trace.prompt_version_record
            prompt_baseline[trace.prompt_version_record.id] += 1
        if trace.model_version_record is not None:
            model_records[trace.model_version_record.id] = trace.model_version_record
            model_baseline[trace.model_version_record.id] += 1

    prompt_contexts: list[dict[str, Any]] = []
    for prompt_id, count in prompt_current.most_common(3):
        record = prompt_records[prompt_id]
        traces_path, regressions_path, incidents_path = build_prompt_version_path(
            project_id=project_id,
            prompt_version_id=record.id,
            version=record.version,
        )
        prompt_contexts.append(
            {
                "id": record.id,
                "project_id": project_id,
                "version": record.version,
                "label": record.label,
                "current_count": count,
                "baseline_count": prompt_baseline.get(prompt_id, 0),
                "traces_path": traces_path,
                "regressions_path": regressions_path,
                "incidents_path": incidents_path,
            }
        )

    model_contexts: list[dict[str, Any]] = []
    for model_id, count in model_current.most_common(3):
        record = model_records[model_id]
        model_contexts.append(
            {
                "id": record.id,
                "project_id": project_id,
                "provider": record.provider,
                "model_name": record.model_name,
                "model_version": record.model_version,
                "route_key": record.route_key,
                "label": record.label,
                "current_count": count,
                "baseline_count": model_baseline.get(model_id, 0),
                "traces_path": build_model_version_path(project_id=project_id, model_version_id=record.id),
            }
        )

    return prompt_contexts, model_contexts


def _prompt_version_record_by_version(
    db: Session,
    *,
    project_id: UUID,
    version: str | None,
    cache: dict[str, PromptVersion],
) -> PromptVersion | None:
    normalized = (version or "").strip()
    if not normalized:
        return None
    cached = cache.get(normalized)
    if cached is not None:
        return cached
    record = db.scalar(
        select(PromptVersion).where(
            PromptVersion.project_id == project_id,
            PromptVersion.version == normalized,
        )
    )
    if record is not None:
        cache[normalized] = record
    return record


def _prompt_record_for_trace(
    db: Session,
    *,
    project_id: UUID,
    trace: Trace,
    cache: dict[str, PromptVersion],
) -> PromptVersion | None:
    if trace.prompt_version_record is not None:
        return trace.prompt_version_record
    return _prompt_version_record_by_version(
        db,
        project_id=project_id,
        version=trace.prompt_version,
        cache=cache,
    )


def _prompt_context_item(
    *,
    project_id: UUID,
    record: PromptVersion,
    current_count: int | None,
    baseline_count: int | None,
) -> dict[str, Any]:
    traces_path, regressions_path, incidents_path = build_prompt_version_path(
        project_id=project_id,
        prompt_version_id=record.id,
        version=record.version,
    )
    return {
        "id": record.id,
        "project_id": project_id,
        "version": record.version,
        "label": record.label,
        "current_count": current_count,
        "baseline_count": baseline_count,
        "traces_path": traces_path,
        "regressions_path": regressions_path,
        "incidents_path": incidents_path,
    }


def _derive_prompt_contexts_from_traces(
    db: Session,
    *,
    project_id: UUID,
    current_traces: list[Trace],
    baseline_traces: list[Trace],
) -> list[dict[str, Any]]:
    version_cache: dict[str, PromptVersion] = {}
    prompt_records: dict[UUID, PromptVersion] = {}
    prompt_current: Counter[UUID] = Counter()
    prompt_baseline: Counter[UUID] = Counter()

    for trace in current_traces:
        record = _prompt_record_for_trace(
            db,
            project_id=project_id,
            trace=trace,
            cache=version_cache,
        )
        if record is None:
            continue
        prompt_records[record.id] = record
        prompt_current[record.id] += 1

    for trace in baseline_traces:
        record = _prompt_record_for_trace(
            db,
            project_id=project_id,
            trace=trace,
            cache=version_cache,
        )
        if record is None:
            continue
        prompt_records[record.id] = record
        prompt_baseline[record.id] += 1

    contexts: list[dict[str, Any]] = []
    for prompt_id, count in prompt_current.most_common(3):
        record = prompt_records[prompt_id]
        contexts.append(
            _prompt_context_item(
                project_id=project_id,
                record=record,
                current_count=count,
                baseline_count=prompt_baseline.get(prompt_id, 0),
            )
        )
    return contexts


def _merge_prompt_contexts(
    existing: list[dict[str, Any]],
    additions: list[dict[str, Any]],
    *,
    limit: int = 3,
) -> list[dict[str, Any]]:
    seen = {item["id"] for item in existing}
    for item in additions:
        if item["id"] in seen:
            continue
        existing.append(item)
        seen.add(item["id"])
        if len(existing) >= limit:
            break
    return existing


def _summary_prompt_record(
    db: Session,
    *,
    project_id: UUID,
    summary: dict[str, Any],
    prompt_id_key: str,
    prompt_version_key: str,
    cache: dict[str, PromptVersion],
) -> PromptVersion | None:
    raw_prompt_id = summary.get(prompt_id_key)
    if raw_prompt_id:
        try:
            prompt_id = UUID(str(raw_prompt_id))
        except (TypeError, ValueError):
            prompt_id = None
        if prompt_id is not None:
            record = db.scalar(
                select(PromptVersion).where(
                    PromptVersion.project_id == project_id,
                    PromptVersion.id == prompt_id,
                )
            )
            if record is not None:
                return record
    return _prompt_version_record_by_version(
        db,
        project_id=project_id,
        version=summary.get(prompt_version_key),
        cache=cache,
    )


def _previous_prompt_record(
    db: Session,
    *,
    project_id: UUID,
    exclude_prompt_ids: set[UUID],
    anchor_time: datetime | None,
) -> PromptVersion | None:
    statement = (
        select(PromptVersion)
        .where(
            PromptVersion.project_id == project_id,
            PromptVersion.id.not_in(exclude_prompt_ids),
        )
        .order_by(desc(PromptVersion.created_at), desc(PromptVersion.id))
    )
    if anchor_time is not None:
        anchored = db.scalar(statement.where(PromptVersion.created_at <= anchor_time))
        if anchored is not None:
            return anchored
    return db.scalar(statement)


def _incident_prompt_counts(
    db: Session,
    *,
    project_id: UUID,
    traces: list[Trace],
) -> Counter[UUID]:
    cache: dict[str, PromptVersion] = {}
    counts: Counter[UUID] = Counter()
    for trace in traces:
        record = _prompt_record_for_trace(
            db,
            project_id=project_id,
            trace=trace,
            cache=cache,
        )
        if record is not None:
            counts[record.id] += 1
    return counts


def derive_incident_registry_contexts(
    db: Session,
    *,
    incident: Incident,
    current_traces: list[Trace],
    baseline_traces: list[Trace],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    summary = incident.summary_json or {}
    window_current_traces = _load_window_traces(
        db,
        incident=incident,
        window_start_key="current_window_start",
        window_end_key="current_window_end",
        with_details=True,
    )
    window_baseline_traces = _load_window_traces(
        db,
        incident=incident,
        window_start_key="baseline_window_start",
        window_end_key="baseline_window_end",
        with_details=True,
    )
    source_current = window_current_traces or current_traces
    source_baseline = window_baseline_traces or baseline_traces

    prompt_contexts = _derive_prompt_contexts_from_traces(
        db,
        project_id=incident.project_id,
        current_traces=source_current,
        baseline_traces=source_baseline,
    )
    _, model_contexts = derive_registry_contexts(
        project_id=incident.project_id,
        current_traces=source_current,
        baseline_traces=source_baseline,
    )

    version_cache: dict[str, PromptVersion] = {}
    current_counts = _incident_prompt_counts(db, project_id=incident.project_id, traces=source_current)
    baseline_counts = _incident_prompt_counts(db, project_id=incident.project_id, traces=source_baseline)

    explicit_current = _summary_prompt_record(
        db,
        project_id=incident.project_id,
        summary=summary,
        prompt_id_key="current_prompt_version_id",
        prompt_version_key="current_prompt_version",
        cache=version_cache,
    )
    explicit_baseline = _summary_prompt_record(
        db,
        project_id=incident.project_id,
        summary=summary,
        prompt_id_key="baseline_prompt_version_id",
        prompt_version_key="baseline_prompt_version",
        cache=version_cache,
    )

    explicit_contexts: list[dict[str, Any]] = []
    if explicit_current is not None:
        explicit_contexts.append(
            _prompt_context_item(
                project_id=incident.project_id,
                record=explicit_current,
                current_count=current_counts.get(explicit_current.id, 0),
                baseline_count=baseline_counts.get(explicit_current.id, 0),
            )
        )
    if explicit_baseline is not None:
        explicit_contexts.append(
            _prompt_context_item(
                project_id=incident.project_id,
                record=explicit_baseline,
                current_count=current_counts.get(explicit_baseline.id, 0),
                baseline_count=baseline_counts.get(explicit_baseline.id, 0),
            )
        )

    if len(prompt_contexts) < 2 and summary.get("scope_type") == "prompt_version":
        scoped_record = _prompt_version_record_by_version(
            db,
            project_id=incident.project_id,
            version=summary.get("scope_id"),
            cache=version_cache,
        )
        if scoped_record is not None:
            explicit_contexts.append(
                _prompt_context_item(
                    project_id=incident.project_id,
                    record=scoped_record,
                    current_count=current_counts.get(scoped_record.id, 0),
                    baseline_count=baseline_counts.get(scoped_record.id, 0),
                )
            )

    if len(prompt_contexts) < 2 and summary.get("simulation_id"):
        try:
            simulation_id = UUID(str(summary.get("simulation_id")))
        except (TypeError, ValueError):
            simulation_id = None
        if simulation_id is not None:
            simulation = db.get(DeploymentSimulation, simulation_id)
            if simulation is not None and simulation.prompt_version_id is not None:
                simulation_prompt = db.scalar(
                    select(PromptVersion).where(
                        PromptVersion.project_id == incident.project_id,
                        PromptVersion.id == simulation.prompt_version_id,
                    )
                )
                if simulation_prompt is not None:
                    explicit_contexts.append(
                        _prompt_context_item(
                            project_id=incident.project_id,
                            record=simulation_prompt,
                            current_count=current_counts.get(simulation_prompt.id, 0),
                            baseline_count=baseline_counts.get(simulation_prompt.id, 0),
                        )
                    )

                simulation_summary = simulation.analysis_json or {}
                baseline_simulation_prompt = _summary_prompt_record(
                    db,
                    project_id=incident.project_id,
                    summary=simulation_summary,
                    prompt_id_key="baseline_prompt_version_id",
                    prompt_version_key="baseline_prompt_version",
                    cache=version_cache,
                )
                if baseline_simulation_prompt is not None:
                    explicit_contexts.append(
                        _prompt_context_item(
                            project_id=incident.project_id,
                            record=baseline_simulation_prompt,
                            current_count=current_counts.get(baseline_simulation_prompt.id, 0),
                            baseline_count=baseline_counts.get(baseline_simulation_prompt.id, 0),
                        )
                    )

    prompt_contexts = _merge_prompt_contexts(prompt_contexts, explicit_contexts)
    if len(prompt_contexts) < 2 and prompt_contexts:
        previous_record = _previous_prompt_record(
            db,
            project_id=incident.project_id,
            exclude_prompt_ids={item["id"] for item in prompt_contexts},
            anchor_time=incident.started_at,
        )
        if previous_record is not None:
            prompt_contexts = _merge_prompt_contexts(
                prompt_contexts,
                [
                    _prompt_context_item(
                        project_id=incident.project_id,
                        record=previous_record,
                        current_count=current_counts.get(previous_record.id, 0),
                        baseline_count=baseline_counts.get(previous_record.id, 0),
                    )
                ],
            )

    return prompt_contexts, model_contexts


def derive_root_cause_hints(
    *,
    incident: Incident | None,
    current_traces: list[Trace],
    baseline_traces: list[Trace],
) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []

    current_model, current_model_counter = _dominant_value(current_traces, "model_name")
    baseline_model, baseline_model_counter = _dominant_value(baseline_traces, "model_name")
    if current_model is not None and len(current_traces) >= 3:
        current_share = _share(current_model_counter, len(current_traces), current_model)
        baseline_share = _share(baseline_model_counter, len(baseline_traces), current_model)
        if current_share is not None and current_share >= Decimal("0.60") and (
            baseline_share is None or current_share - baseline_share >= Decimal("0.25")
        ):
            supporting = [trace for trace in current_traces if trace.model_name == current_model]
            hints.append(
                {
                    "hint_type": "model_concentration",
                    "dimension": "model_name",
                    "current_value": current_model,
                    "baseline_value": baseline_model,
                    "current_count": current_model_counter[current_model],
                    "baseline_count": baseline_model_counter.get(current_model, 0),
                    "current_share": current_share,
                    "baseline_share": baseline_share,
                    "current_metric_value": None,
                    "baseline_metric_value": None,
                    "cluster_started_at": None,
                    "supporting_trace_ids": _top_trace_ids(supporting),
                    "metadata_json": None,
                }
            )

    current_prompt, current_prompt_counter = _dominant_value(current_traces, "prompt_version")
    baseline_prompt, baseline_prompt_counter = _dominant_value(baseline_traces, "prompt_version")
    if current_prompt is not None and current_prompt != "unknown" and len(current_traces) >= 3:
        current_share = _share(current_prompt_counter, len(current_traces), current_prompt)
        baseline_share = _share(baseline_prompt_counter, len(baseline_traces), current_prompt)
        if current_share is not None and current_share >= Decimal("0.60") and (
            baseline_share is None or current_share - baseline_share >= Decimal("0.25")
        ):
            supporting = [trace for trace in current_traces if trace.prompt_version == current_prompt]
            hints.append(
                {
                    "hint_type": "prompt_version_concentration",
                    "dimension": "prompt_version",
                    "current_value": current_prompt,
                    "baseline_value": baseline_prompt if baseline_prompt != "unknown" else None,
                    "current_count": current_prompt_counter[current_prompt],
                    "baseline_count": baseline_prompt_counter.get(current_prompt, 0),
                    "current_share": current_share,
                    "baseline_share": baseline_share,
                    "current_metric_value": None,
                    "baseline_metric_value": None,
                    "cluster_started_at": None,
                    "supporting_trace_ids": _top_trace_ids(supporting),
                    "metadata_json": None,
                }
            )

    current_retrieval_latencies = [
        trace.retrieval_span.retrieval_latency_ms
        for trace in current_traces
        if trace.retrieval_span is not None and trace.retrieval_span.retrieval_latency_ms is not None
    ]
    baseline_retrieval_latencies = [
        trace.retrieval_span.retrieval_latency_ms
        for trace in baseline_traces
        if trace.retrieval_span is not None and trace.retrieval_span.retrieval_latency_ms is not None
    ]
    current_latencies = [trace.latency_ms for trace in current_traces if trace.latency_ms is not None]
    baseline_latencies = [trace.latency_ms for trace in baseline_traces if trace.latency_ms is not None]
    current_retrieval_median = _median_int(current_retrieval_latencies)
    baseline_retrieval_median = _median_int(baseline_retrieval_latencies)
    current_latency_median = _median_int(current_latencies)
    baseline_latency_median = _median_int(baseline_latencies)
    if (
        current_retrieval_median is not None
        and baseline_retrieval_median is not None
        and current_latency_median is not None
        and baseline_latency_median is not None
        and current_retrieval_median - baseline_retrieval_median >= Decimal("100")
        and current_latency_median - baseline_latency_median >= Decimal("200")
    ):
        supporting = sorted(
            [trace for trace in current_traces if trace.retrieval_span is not None],
            key=lambda trace: (
                trace.retrieval_span.retrieval_latency_ms or 0,
                trace.latency_ms or 0,
            ),
            reverse=True,
        )
        hints.append(
            {
                "hint_type": "retrieval_latency_increase",
                "dimension": "retrieval_latency_ms",
                "current_value": None,
                "baseline_value": None,
                "current_count": len(current_retrieval_latencies),
                "baseline_count": len(baseline_retrieval_latencies),
                "current_share": None,
                "baseline_share": None,
                "current_metric_value": current_retrieval_median,
                "baseline_metric_value": baseline_retrieval_median,
                "cluster_started_at": None,
                "supporting_trace_ids": _top_trace_ids(supporting),
                "metadata_json": {
                    "current_latency_median_ms": str(current_latency_median),
                    "baseline_latency_median_ms": str(baseline_latency_median),
                },
            }
        )

    failing_current = [
        trace
        for trace in current_traces
        if not trace.success or _structured_output_label(trace) == "fail"
    ]
    if len(failing_current) >= 3:
        dimension_counters = {
            "error_type": Counter(trace.error_type or "unknown" for trace in failing_current),
            "model_name": Counter(trace.model_name or "unknown" for trace in failing_current),
            "prompt_version": Counter(trace.prompt_version or "unknown" for trace in failing_current),
        }
        best_dimension = None
        best_value = None
        best_share = Decimal("0")
        for dimension, counter in dimension_counters.items():
            value, _ = (counter.most_common(1)[0] if counter else (None, 0))
            if value is None:
                continue
            share = _share(counter, len(failing_current), value)
            if share is not None and share > best_share:
                best_dimension = dimension
                best_value = value
                best_share = share
        if best_dimension is not None and best_value is not None and best_share >= Decimal("0.60"):
            supporting = [trace for trace in failing_current if (getattr(trace, best_dimension) or "unknown") == best_value]
            baseline_counter = Counter((getattr(trace, best_dimension) or "unknown") for trace in baseline_traces)
            hints.append(
                {
                    "hint_type": "failure_cluster",
                    "dimension": best_dimension,
                    "current_value": best_value if best_value != "unknown" else None,
                    "baseline_value": None,
                    "current_count": len(supporting),
                    "baseline_count": baseline_counter.get(best_value, 0),
                    "current_share": best_share,
                    "baseline_share": _share(baseline_counter, len(baseline_traces), best_value),
                    "current_metric_value": None,
                    "baseline_metric_value": None,
                    "cluster_started_at": None,
                    "supporting_trace_ids": _top_trace_ids(supporting),
                    "metadata_json": {"failure_count": len(failing_current)},
                }
            )

    incident_started_at = _coerce_utc_datetime(incident.started_at) if incident is not None else None
    failing_after_start = (
        [
            trace
            for trace in failing_current
            if _coerce_utc_datetime(trace.timestamp) >= incident_started_at
        ]
        if incident_started_at is not None
        else []
    )
    if incident is not None and len(failing_current) >= 3 and len(failing_after_start) / len(failing_current) >= 0.70:
        cluster_started_at = min(_coerce_utc_datetime(trace.timestamp) for trace in failing_after_start)
        hints.append(
            {
                "hint_type": "time_cluster",
                "dimension": "timestamp",
                "current_value": cluster_started_at.isoformat(),
                "baseline_value": None,
                "current_count": len(failing_after_start),
                "baseline_count": 0,
                "current_share": quantize_decimal(
                    Decimal(len(failing_after_start)) / Decimal(len(failing_current))
                ),
                "baseline_share": None,
                "current_metric_value": None,
                "baseline_metric_value": None,
                "cluster_started_at": cluster_started_at,
                "supporting_trace_ids": _top_trace_ids(sorted(failing_after_start, key=lambda trace: trace.timestamp)),
                "metadata_json": {"failure_count": len(failing_current)},
            }
        )

    return hints


def build_trace_compare_item(trace: Trace) -> dict[str, Any]:
    structured_output_label = _structured_output_label(trace)
    structured_output_reason = _structured_output_reason(trace)
    custom_metric_results = []
    for evaluation in getattr(trace, "evaluations", []):
        if not evaluation.eval_type.startswith("custom_metric:"):
            continue
        raw = evaluation.raw_result_json or {}
        custom_metric_results.append(
            {
                "metric_key": raw.get("metric_key"),
                "name": raw.get("metric_name") or evaluation.eval_type,
                "mode": raw.get("value_mode") or "boolean",
                "value": raw.get("result_value"),
                "matched": bool(raw.get("result_value")),
            }
        )
    return {
        "id": trace.id,
        "request_id": trace.request_id,
        "timestamp": trace.timestamp,
        "model_name": trace.model_name,
        "prompt_version": trace.prompt_version,
        "success": trace.success,
        "error_type": trace.error_type,
        "latency_ms": trace.latency_ms,
        "prompt_tokens": trace.prompt_tokens,
        "completion_tokens": trace.completion_tokens,
        "total_cost_usd": trace.total_cost_usd,
        "prompt_version_record": _prompt_version_record_item(trace),
        "model_version_record": _model_version_record_item(trace),
        "structured_output": {
            "label": structured_output_label,
            "score": next(
                (
                    evaluation.score
                    for evaluation in getattr(trace, "evaluations", [])
                    if evaluation.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE
                ),
                None,
            ),
            "reason": structured_output_reason,
        }
        if structured_output_label is not None or structured_output_reason is not None
        else None,
        "refusal_detected": trace_refusal_detected(trace),
        "custom_metric_results": custom_metric_results,
        "retrieval": {
            "retrieval_latency_ms": trace.retrieval_span.retrieval_latency_ms,
            "source_count": trace.retrieval_span.source_count,
            "top_k": trace.retrieval_span.top_k,
        }
        if trace.retrieval_span is not None
        else None,
        "metadata_excerpt_json": _selected_metadata(trace),
    }


def get_incident_events(
    db: Session,
    operator: OperatorContext,
    incident_id: UUID,
) -> list[IncidentEvent]:
    incident = get_incident_detail(db, operator, incident_id)
    statement = (
        select(IncidentEvent)
        .options(joinedload(IncidentEvent.actor_operator_user))
        .where(IncidentEvent.incident_id == incident.id)
        .order_by(desc(IncidentEvent.created_at), desc(IncidentEvent.id))
    )
    return db.scalars(statement).unique().all()


def acknowledge_incident(db: Session, operator: OperatorContext, incident_id: UUID) -> Incident:
    incident = get_incident_detail(db, operator, incident_id)
    timestamp = _now()
    if (
        incident.acknowledged_at is not None
        and incident.acknowledged_by_operator_user_id == operator.operator.id
    ):
        return incident
    incident.acknowledged_at = timestamp
    incident.acknowledged_by_operator_user_id = operator.operator.id
    incident.updated_at = timestamp
    db.add(incident)
    append_incident_event(
        db,
        incident=incident,
        event_type=INCIDENT_EVENT_ACKNOWLEDGED,
        actor_operator_user_id=operator.operator.id,
        metadata_json={"status": incident.status},
        created_at=timestamp,
    )
    log_action(
        db,
        organization_id=incident.organization_id,
        user_id=operator.operator.id,
        action="incident_acknowledged",
        resource_type="incident",
        resource_id=incident.id,
        metadata={"project_id": str(incident.project_id), "status": incident.status},
    )
    db.commit()
    return get_incident_detail(db, operator, incident.id)


def _require_operator_membership_for_incident(
    db: Session, *, incident: Incident, operator_user_id: UUID
) -> User:
    candidate = db.get(User, operator_user_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")

    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == incident.organization_id,
            OrganizationMember.user_id == operator_user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Operator is not a member of this organization",
        )
    return candidate


def assign_incident_owner(
    db: Session,
    operator: OperatorContext,
    *,
    incident_id: UUID,
    owner_operator_user_id: UUID | None,
) -> Incident:
    incident = get_incident_detail(db, operator, incident_id)
    timestamp = _now()
    if owner_operator_user_id is None:
        if incident.owner_operator_user_id is None:
            return incident
        previous_owner_id = incident.owner_operator_user_id
        incident.owner_operator_user_id = None
        incident.updated_at = timestamp
        db.add(incident)
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_OWNER_CLEARED,
            actor_operator_user_id=operator.operator.id,
            metadata_json={"previous_owner_operator_user_id": str(previous_owner_id)},
            created_at=timestamp,
        )
        log_action(
            db,
            organization_id=incident.organization_id,
            user_id=operator.operator.id,
            action="incident_owner_cleared",
            resource_type="incident",
            resource_id=incident.id,
            metadata={"project_id": str(incident.project_id)},
        )
    else:
        owner = _require_operator_membership_for_incident(
            db, incident=incident, operator_user_id=owner_operator_user_id
        )
        if incident.owner_operator_user_id == owner_operator_user_id:
            return incident
        incident.owner_operator_user_id = owner_operator_user_id
        incident.updated_at = timestamp
        db.add(incident)
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_OWNER_ASSIGNED,
            actor_operator_user_id=operator.operator.id,
            metadata_json={
                "owner_operator_user_id": str(owner_operator_user_id),
                "owner_operator_email": owner.email,
            },
            created_at=timestamp,
        )
        log_action(
            db,
            organization_id=incident.organization_id,
            user_id=operator.operator.id,
            action="incident_owner_assigned",
            resource_type="incident",
            resource_id=incident.id,
            metadata={
                "project_id": str(incident.project_id),
                "owner_operator_user_id": str(owner_operator_user_id),
            },
        )
    db.commit()
    return get_incident_detail(db, operator, incident.id)


def resolve_incident(db: Session, operator: OperatorContext, incident_id: UUID) -> Incident:
    incident = get_incident_detail(db, operator, incident_id)
    timestamp = _now()
    _mark_resolved(
        db,
        incident=incident,
        resolved_at=timestamp,
        actor_operator_user_id=operator.operator.id,
        reason="manual_resolve",
    )
    log_action(
        db,
        organization_id=incident.organization_id,
        user_id=operator.operator.id,
        action="incident_resolved",
        resource_type="incident",
        resource_id=incident.id,
        metadata={"project_id": str(incident.project_id)},
    )
    db.commit()
    return get_incident_detail(db, operator, incident.id)


def reopen_incident(db: Session, operator: OperatorContext, incident_id: UUID) -> Incident:
    incident = get_incident_detail(db, operator, incident_id)
    timestamp = _now()
    _mark_reopened(
        db,
        incident=incident,
        reopened_at=timestamp,
        actor_operator_user_id=operator.operator.id,
        reason="manual_reopen",
    )
    log_action(
        db,
        organization_id=incident.organization_id,
        user_id=operator.operator.id,
        action="incident_reopened",
        resource_type="incident",
        resource_id=incident.id,
        metadata={"project_id": str(incident.project_id)},
    )
    db.commit()
    return get_incident_detail(db, operator, incident.id)


def get_incident_alert_deliveries(
    db: Session, operator: OperatorContext, incident_id: UUID
) -> list[AlertDelivery]:
    incident = get_incident_detail(db, operator, incident_id)
    statement = (
        select(AlertDelivery)
        .where(AlertDelivery.incident_id == incident.id)
        .order_by(desc(AlertDelivery.created_at), desc(AlertDelivery.id))
    )
    return db.scalars(statement).all()
