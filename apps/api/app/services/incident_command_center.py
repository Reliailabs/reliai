from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.schemas.timeline import TimelineEventRead
from app.services.auth import OperatorContext
from app.services.incidents import (
    get_incident_compare_traces,
    get_incident_detail,
    get_incident_events,
    get_incident_regressions,
    get_incident_traces,
)
from app.services.reliability_graph import get_incident_graph
from app.services.root_cause_engine import RootCauseReport, get_incident_analysis
from app.services.timeline import get_project_timeline
from app.services.traces import TraceCompareResult, get_trace_compare


@dataclass(frozen=True)
class GuardrailActivitySummary:
    policy_type: str
    trigger_count: int
    last_trigger_time: object | None


@dataclass(frozen=True)
class IncidentCommandCenterResult:
    incident: Incident
    regressions: list[RegressionSnapshot]
    traces: list[Trace]
    events: list[IncidentEvent]
    representative_traces: list[Trace]
    baseline_traces: list[Trace]
    root_cause_report: RootCauseReport
    graph_root_causes: list[object]
    trace_compare: TraceCompareResult | None
    compare_link: str
    guardrail_activity: list[GuardrailActivitySummary]
    related_regressions: list[RegressionSnapshot]
    recent_signals: list[TimelineEventRead]


def _coerce_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _select_anchor_trace(current_traces: list[Trace]) -> Trace | None:
    if not current_traces:
        return None
    failing = [trace for trace in current_traces if not trace.success]
    ordered = failing or current_traces
    return sorted(
        ordered,
        key=lambda trace: (
            0 if not trace.success else 1,
            -(trace.latency_ms or 0),
            trace.timestamp,
            str(trace.id),
        ),
    )[0]


def _guardrail_activity(
    db: Session,
    *,
    project_id: UUID,
    environment_name: str | None = None,
) -> list[GuardrailActivitySummary]:
    statement = (
        select(
            GuardrailPolicy.policy_type,
            func.count(GuardrailRuntimeEvent.id).label("trigger_count"),
            func.max(GuardrailRuntimeEvent.created_at).label("last_trigger_time"),
        )
        .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
        .where(GuardrailPolicy.project_id == project_id)
    )
    if environment_name is not None:
        statement = statement.where(GuardrailPolicy.environment_ref.has(name=environment_name))
    rows = db.execute(
        statement
        .group_by(GuardrailPolicy.policy_type)
        .order_by(desc("trigger_count"), desc("last_trigger_time"), GuardrailPolicy.policy_type.asc())
    ).all()
    return [
        GuardrailActivitySummary(
            policy_type=row.policy_type,
            trigger_count=int(row.trigger_count or 0),
            last_trigger_time=row.last_trigger_time,
        )
        for row in rows
    ]


def _related_regressions(db: Session, *, incident: Incident, limit: int = 6) -> list[RegressionSnapshot]:
    summary = incident.summary_json or {}
    statement = (
        select(RegressionSnapshot)
        .where(RegressionSnapshot.project_id == incident.project_id)
        .order_by(desc(RegressionSnapshot.detected_at), desc(RegressionSnapshot.id))
    )
    metric_name = summary.get("metric_name")
    scope_type = summary.get("scope_type")
    scope_id = summary.get("scope_id")
    if metric_name is not None:
        statement = statement.where(RegressionSnapshot.metric_name == metric_name)
    if scope_type is not None:
        statement = statement.where(RegressionSnapshot.scope_type == scope_type)
    if scope_id is not None:
        statement = statement.where(RegressionSnapshot.scope_id == scope_id)
    return db.scalars(statement.limit(limit)).all()


def _recent_signals(db: Session, *, incident: Incident, limit: int = 8) -> list[TimelineEventRead]:
    timeline = get_project_timeline(
        db,
        project_id=incident.project_id,
        limit=max(limit * 2, 16),
        environment=incident.environment_ref.name if incident.environment_ref is not None else None,
    )
    incident_started_at = _coerce_utc_datetime(incident.started_at)
    start = incident_started_at - timedelta(hours=6)
    end = incident_started_at + timedelta(hours=6)
    filtered = [
        item
        for item in timeline
        if (item.metadata or {}).get("incident_id") != str(incident.id)
        and start <= _coerce_utc_datetime(item.timestamp) <= end
    ]
    if len(filtered) < limit:
        filtered = [
            item for item in timeline if (item.metadata or {}).get("incident_id") != str(incident.id)
        ]
    return [TimelineEventRead.model_validate(item) for item in filtered[:limit]]


def get_incident_command_center(
    db: Session,
    operator: OperatorContext,
    incident_id: UUID,
) -> IncidentCommandCenterResult:
    incident = get_incident_detail(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    root_cause_report = get_incident_analysis(db, operator, incident_id=incident_id)
    graph = get_incident_graph(db, operator, incident_id)

    anchor_trace = _select_anchor_trace(representative_traces)
    trace_compare = get_trace_compare(db, operator, anchor_trace.id) if anchor_trace is not None else None
    compare_link = f"/traces/{anchor_trace.id}/compare" if anchor_trace is not None else f"/incidents/{incident.id}/compare"

    # Keep graph-derived root causes attached to root-cause evidence without introducing another top-level contract.
    root_cause_report.evidence["graph_root_causes"] = [
        {
            "cause_type": item.cause_type,
            "cause_id": item.cause_id,
            "confidence_score": item.confidence_score,
            "evidence_json": item.evidence_json,
        }
        for item in graph["root_causes"]
    ]

    return IncidentCommandCenterResult(
        incident=incident,
        regressions=regressions,
        traces=traces,
        events=events,
        representative_traces=representative_traces,
        baseline_traces=baseline_traces,
        root_cause_report=root_cause_report,
        graph_root_causes=graph["root_causes"],
        trace_compare=trace_compare,
        compare_link=compare_link,
        guardrail_activity=_guardrail_activity(
            db,
            project_id=incident.project_id,
            environment_name=incident.environment_ref.name if incident.environment_ref is not None else None,
        ),
        related_regressions=_related_regressions(db, incident=incident),
        recent_signals=_recent_signals(db, incident=incident),
    )
