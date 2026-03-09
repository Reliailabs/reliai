from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time, timezone
from decimal import Decimal
from typing import Any, Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.models.alert_delivery import AlertDelivery
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.organization_member import OrganizationMember
from app.models.operator_user import OperatorUser
from app.models.project import Project
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.schemas.incident import IncidentListQuery
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.rollups import RollupScope

INCIDENT_WINDOW_MINUTES = 60

INCIDENT_EVENT_OPENED = "opened"
INCIDENT_EVENT_UPDATED = "updated"
INCIDENT_EVENT_ACKNOWLEDGED = "acknowledged"
INCIDENT_EVENT_OWNER_ASSIGNED = "owner_assigned"
INCIDENT_EVENT_OWNER_CLEARED = "owner_cleared"
INCIDENT_EVENT_RESOLVED = "resolved"
INCIDENT_EVENT_REOPENED = "reopened"


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
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


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
    if rule.metric_name in {"structured_output_validity_pass_rate", "success_rate"}:
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
    if rule.percent_threshold is not None and abs(snapshot.delta_percent or Decimal("0")) < rule.percent_threshold:
        return False
    return True


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
    elif rule.metric_name == "p95_latency_ms":
        statement = statement.order_by(desc(Trace.latency_ms), desc(Trace.timestamp))
    elif rule.metric_name == "average_cost_usd_per_trace":
        statement = statement.order_by(desc(Trace.total_cost_usd), desc(Trace.timestamp))
    else:
        statement = statement.order_by(desc(Trace.timestamp))
    return db.scalars(statement.limit(5)).all()


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
            continue

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
        event_metadata = _incident_event_metadata(scope=scope, snapshot=snapshot, severity=severity)

        if incident is None:
            incident = Incident(
                organization_id=scope.organization_id,
                project_id=scope.project_id,
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

    statement = (
        select(Incident)
        .options(
            joinedload(Incident.project),
            joinedload(Incident.acknowledged_by_operator),
            joinedload(Incident.owner_operator),
        )
        .where(Incident.organization_id.in_(operator.organization_ids))
        .order_by(desc(Incident.started_at), desc(Incident.updated_at))
    )
    if query.project_id is not None:
        statement = statement.where(Incident.project_id == query.project_id)
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

    incidents = db.scalars(statement.limit(query.limit)).unique().all()
    for incident in incidents:
        incident.latest_alert_delivery = _latest_alert_delivery(db, incident.id)
    return incidents


def get_incident_detail(db: Session, operator: OperatorContext, incident_id: UUID) -> Incident:
    incident = db.scalar(
        select(Incident)
        .options(
            joinedload(Incident.project),
            joinedload(Incident.acknowledged_by_operator),
            joinedload(Incident.owner_operator),
        )
        .where(Incident.id == incident_id, Incident.organization_id.in_(operator.organization_ids))
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
    return None


def get_incident_representative_traces(db: Session, incident: Incident) -> list[Trace]:
    summary = incident.summary_json or {}
    scope_type = summary.get("scope_type")
    scope_id = summary.get("scope_id")
    current_window_start = summary.get("current_window_start")
    current_window_end = summary.get("current_window_end")

    statement = select(Trace).where(
        Trace.organization_id == incident.organization_id,
        Trace.project_id == incident.project_id,
    )
    if current_window_start is not None:
        statement = statement.where(Trace.timestamp >= datetime.fromisoformat(current_window_start))
    if current_window_end is not None:
        statement = statement.where(Trace.timestamp <= datetime.fromisoformat(current_window_end))
    if scope_type == "prompt_version" and scope_id:
        statement = statement.where(Trace.prompt_version == scope_id)

    window_traces = db.scalars(statement.order_by(desc(Trace.timestamp)).limit(50)).all()

    ranked: list[Trace] = []
    failing_recent = [trace for trace in window_traces if not trace.success]
    failing_recent.sort(key=lambda trace: trace.timestamp, reverse=True)
    ranked.extend(failing_recent[:3])

    near_start = sorted(
        window_traces,
        key=lambda trace: abs((trace.timestamp - incident.started_at).total_seconds()),
    )
    for trace in near_start:
        if trace.id not in {item.id for item in ranked}:
            ranked.append(trace)
        if len(ranked) >= 5:
            break

    if not ranked:
        ranked = get_incident_traces(db, incident)[:5]
    return ranked[:5]


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
    db.commit()
    return get_incident_detail(db, operator, incident.id)


def _require_operator_membership_for_incident(
    db: Session, *, incident: Incident, operator_user_id: UUID
) -> OperatorUser:
    candidate = db.get(OperatorUser, operator_user_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")

    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == incident.organization_id,
            OrganizationMember.auth_user_id == str(operator_user_id),
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
