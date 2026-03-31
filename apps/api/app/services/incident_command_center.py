from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.guardrail_policy import GuardrailPolicy
from app.models.reliability_graph_node import ReliabilityGraphNode
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.schemas.timeline import TimelineEventRead
from app.services.auth import OperatorContext
from app.services.incidents import (
    INCIDENT_EVENT_CONFIG_APPLIED,
    INCIDENT_EVENT_CONFIG_UNDONE,
    build_resolution_impact_baseline,
    compute_resolution_impact,
    get_incident_compare_traces,
    get_incident_detail,
    get_incident_events,
    get_incident_regressions,
    get_incident_traces,
)
from app.services.global_reliability_patterns import find_similar_platform_failures
from app.services.reliability_graph import (
    NODE_INCIDENT,
    get_graph_guardrail_recommendations,
    get_incident_graph,
    get_related_nodes,
)
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
    possible_root_causes: list[dict]
    graph_related_patterns: list[dict]
    similar_platform_failures: list[dict]
    recommended_mitigations: list[str]
    trace_compare: TraceCompareResult | None
    compare_link: str
    guardrail_activity: list[GuardrailActivitySummary]
    related_regressions: list[RegressionSnapshot]
    recent_signals: list[TimelineEventRead]
    resolution_impact: dict | None = None
    fix_action_recorded: bool = False


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


def _possible_root_causes(
    db: Session,
    *,
    operator: OperatorContext,
    incident: Incident,
    limit: int = 4,
) -> list[dict]:
    incident_node = db.scalar(
        select(ReliabilityGraphNode).where(
            ReliabilityGraphNode.organization_id == incident.organization_id,
            ReliabilityGraphNode.project_id == incident.project_id,
            ReliabilityGraphNode.node_type == NODE_INCIDENT,
            ReliabilityGraphNode.node_key == str(incident.id),
        )
    )
    if incident_node is None:
        return []
    _, related = get_related_nodes(db, node_id=incident_node.id, organization_ids=operator.organization_ids)
    items: list[dict] = []
    type_map = {
        "model_family": "model_pattern",
        "prompt_version": "prompt_pattern",
        "retrieval_strategy": "retrieval_pattern",
        "deployment": "deployment_pattern",
        "guardrail_policy": "guardrail_pattern",
    }
    for related_node, edge in related:
        mapped_type = type_map.get(related_node.node_type)
        if mapped_type is None:
            continue
        items.append(
            {
                "type": mapped_type,
                "pattern": related_node.node_key,
                "confidence": round(float(edge.confidence), 4),
            }
        )
    items.sort(key=lambda item: (-item["confidence"], item["pattern"]))
    return items[:limit]


def _graph_related_patterns(
    db: Session,
    *,
    operator: OperatorContext,
    incident: Incident,
    limit: int = 4,
) -> list[dict]:
    incident_node = db.scalar(
        select(ReliabilityGraphNode).where(
            ReliabilityGraphNode.organization_id == incident.organization_id,
            ReliabilityGraphNode.project_id == incident.project_id,
            ReliabilityGraphNode.node_type == NODE_INCIDENT,
            ReliabilityGraphNode.node_key == str(incident.id),
        )
    )
    if incident_node is None:
        return []
    _, related = get_related_nodes(db, node_id=incident_node.id, organization_ids=operator.organization_ids)
    patterns: list[dict] = []
    for related_node, edge in related:
        patterns.append(
            {
                "pattern": related_node.node_key,
                "type": related_node.node_type,
                "confidence": round(float(edge.confidence), 4),
                "trace_count": int(edge.trace_count or 0),
            }
        )
    patterns.sort(key=lambda item: (-item["confidence"], -item["trace_count"], item["pattern"]))
    return patterns[:limit]


def _recommended_mitigations(
    db: Session,
    *,
    operator: OperatorContext,
    incident: Incident,
) -> list[str]:
    recommendations = get_graph_guardrail_recommendations(
        db,
        organization_ids=operator.organization_ids,
        project_id=incident.project_id,
    )
    mitigations = [
        f"enable {item['policy_type']} guardrail"
        for item in recommendations[:3]
    ]
    summary = incident.summary_json or {}
    retrieval_chunks = summary.get("retrieval_chunks")
    metric_name = str(summary.get("metric_name") or "")
    if retrieval_chunks is not None or "latency" in metric_name:
        mitigations.append("reduce retrieval chunk count")
    unique: list[str] = []
    seen: set[str] = set()
    for item in mitigations:
        if item in seen:
            continue
        seen.add(item)
        unique.append(item)
    return unique


def _similar_platform_failures(
    db: Session,
    *,
    incident: Incident,
    traces: list[Trace],
    limit: int = 3,
) -> list[dict]:
    model_family = None
    for trace in traces:
        metadata = trace.metadata_json or {}
        model_family = str(metadata.get("__model_name") or trace.model_name or "").strip() or None
        if model_family:
            break
    return find_similar_platform_failures(db, model_family=model_family, limit=limit)


def _resolution_action_label(event_type: str) -> str:
    if event_type == INCIDENT_EVENT_CONFIG_UNDONE:
        return "after config rollback"
    return "after config update"


def _resolution_impact_for_event(
    db: Session,
    *,
    incident: Incident,
    event: IncidentEvent,
) -> dict | None:
    if event.event_type not in {INCIDENT_EVENT_CONFIG_APPLIED, INCIDENT_EVENT_CONFIG_UNDONE}:
        return None
    metadata = event.metadata_json or {}
    existing = metadata.get("resolution_impact") if isinstance(metadata, dict) else None
    action_time = _coerce_utc_datetime(event.created_at)
    baseline = existing
    if existing is None:
        baseline = build_resolution_impact_baseline(db, incident=incident, action_time=action_time)
        if baseline is None:
            return None
    impact = compute_resolution_impact(
        db,
        incident=incident,
        action_time=action_time,
        action_label=_resolution_action_label(event.event_type),
        baseline=baseline,
    )
    if impact is None:
        return None
    if existing != impact:
        metadata = dict(metadata) if isinstance(metadata, dict) else {}
        metadata["resolution_impact"] = impact
        event.metadata_json = metadata
        db.add(event)
        db.commit()
    return impact


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
    possible_root_causes = _possible_root_causes(db, operator=operator, incident=incident)
    graph_related_patterns = _graph_related_patterns(db, operator=operator, incident=incident)
    similar_platform_failures = _similar_platform_failures(db, incident=incident, traces=traces)
    recommended_mitigations = _recommended_mitigations(db, operator=operator, incident=incident)

    resolution_impact = None
    for event in events:
        impact = _resolution_impact_for_event(db, incident=incident, event=event)
        if impact is not None:
            resolution_impact = impact
            break

    fix_action_recorded = any(
        event.event_type in {INCIDENT_EVENT_CONFIG_APPLIED, INCIDENT_EVENT_CONFIG_UNDONE}
        for event in events
    )

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
        possible_root_causes=possible_root_causes,
        graph_related_patterns=graph_related_patterns,
        similar_platform_failures=similar_platform_failures,
        recommended_mitigations=recommended_mitigations,
        trace_compare=trace_compare,
        compare_link=compare_link,
        guardrail_activity=_guardrail_activity(
            db,
            project_id=incident.project_id,
            environment_name=incident.environment_ref.name if incident.environment_ref is not None else None,
        ),
        related_regressions=_related_regressions(db, incident=incident),
        recent_signals=_recent_signals(db, incident=incident),
        resolution_impact=resolution_impact,
        fix_action_recorded=fix_action_recorded,
    )
