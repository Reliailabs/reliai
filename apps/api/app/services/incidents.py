from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.models.incident import Incident
from app.models.project import Project
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.schemas.incident import IncidentListQuery
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.rollups import RollupScope

INCIDENT_WINDOW_MINUTES = 60


@dataclass(frozen=True)
class IncidentRule:
    incident_type: str
    metric_name: str
    title_template: str
    minimum_sample_size: int
    comparator: str
    absolute_threshold: Decimal
    percent_threshold: Decimal | None


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


def _sample_traces(db: Session, scope: RollupScope, rule: IncidentRule, window_start: str, window_end: str) -> list[Trace]:
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


def sync_incidents_for_scope(
    db: Session,
    *,
    scope: RollupScope,
    project: Project,
    regressions: Iterable[RegressionSnapshot],
    detected_at: datetime,
) -> list[Incident]:
    snapshot_by_metric = {snapshot.metric_name: snapshot for snapshot in regressions}
    incidents: list[Incident] = []

    for rule in INCIDENT_RULES:
        snapshot = snapshot_by_metric[rule.metric_name]
        fingerprint = _fingerprint(scope, rule)
        incident = db.scalar(select(Incident).where(Incident.fingerprint == fingerprint))
        breaches = _snapshot_breaches(rule, snapshot)

        if not breaches:
            if incident is not None and incident.status == "open":
                incident.status = "resolved"
                incident.updated_at = detected_at
                incident.resolved_at = detected_at
                db.add(incident)
                incidents.append(incident)
            continue

        metadata = snapshot.metadata_json or {}
        sample_traces = _sample_traces(
            db,
            scope,
            rule,
            metadata["current_window_start"],
            metadata["current_window_end"],
        )
        summary_json = {
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
        }

        if incident is None:
            incident = Incident(
                organization_id=scope.organization_id,
                project_id=scope.project_id,
                incident_type=rule.incident_type,
                fingerprint=fingerprint,
                started_at=detected_at,
                status="open",
            )
        incident.severity = _severity(rule, snapshot)
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
        incidents.append(incident)

    return incidents


def list_incidents(db: Session, operator: OperatorContext, query: IncidentListQuery) -> list[Incident]:
    if query.project_id is not None:
        require_project_access(db, operator, query.project_id)

    statement = (
        select(Incident)
        .options(joinedload(Incident.project))
        .where(Incident.organization_id.in_(operator.organization_ids))
        .order_by(desc(Incident.started_at), desc(Incident.updated_at))
    )
    if query.project_id is not None:
        statement = statement.where(Incident.project_id == query.project_id)
    if query.status is not None:
        statement = statement.where(Incident.status == query.status)
    return db.scalars(statement.limit(query.limit)).unique().all()


def get_incident_detail(db: Session, operator: OperatorContext, incident_id: UUID) -> Incident:
    incident = db.scalar(
        select(Incident)
        .options(joinedload(Incident.project))
        .where(Incident.id == incident_id, Incident.organization_id.in_(operator.organization_ids))
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
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
