from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.alert_delivery import AlertDelivery
from app.models.evaluation import Evaluation
from app.models.evaluation_rollup import EvaluationRollup
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.project import Project
from app.models.prompt_version import PromptVersion
from app.models.regression_snapshot import RegressionSnapshot
from app.models.reliability_metric import ReliabilityMetric
from app.models.trace import Trace
from app.services.alerts import ALERT_STATUS_FAILED, ALERT_STATUS_SENT
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE
from app.services.incidents import (
    INCIDENT_EVENT_OPENED,
    INCIDENT_EVENT_REOPENED,
    snapshot_breaches_any_rule,
)

METRIC_INCIDENT_DETECTION_LATENCY_P90 = "incident_detection_latency_p90"
METRIC_MTTA_P90 = "MTTA_p90"
METRIC_MTTR_P90 = "MTTR_p90"
METRIC_INCIDENT_RECURRENCE_RATE = "incident_recurrence_rate"
METRIC_FALSE_POSITIVE_RATE = "false_positive_rate"
METRIC_ALERT_DELIVERY_SUCCESS_RATE = "alert_delivery_success_rate"
METRIC_DETECTION_COVERAGE = "detection_coverage"
METRIC_TELEMETRY_FRESHNESS_MINUTES = "telemetry_freshness_minutes"
METRIC_EXPLAINABILITY_SCORE = "explainability_score"
METRIC_QUALITY_PASS_RATE = "quality_pass_rate"
METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE = "structured_output_validity_rate"
METRIC_ROOT_CAUSE_LOCALIZATION_SCORE = "root_cause_localization_score"
METRIC_INCIDENT_DENSITY = "incident_density"

SCOPE_PROJECT = "project"
SCOPE_PROMPT_VERSION = "prompt_version"
SCOPE_MODEL_VERSION = "model_version"

HOUR_MINUTES = 60
DAY_MINUTES = 1440
WEEK_MINUTES = 10080

SCORECARD_METRIC_TARGETS = {
    "detection_latency_p90": ("max", 15.0),
    "MTTA_p90": ("max", 30.0),
    "MTTR_p90": ("max", 240.0),
    "false_positive_rate": ("max", 0.10),
    "detection_coverage": ("min", 0.90),
    "alert_delivery_success_rate": ("min", 0.95),
    "explainability_score": ("min", 0.95),
    "incident_density": ("max", 2.0),
}


@dataclass(frozen=True)
class ReliabilityScope:
    organization_id: UUID
    project_id: UUID
    scope_type: str
    scope_id: str


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _window(anchor_time: datetime, minutes: int) -> tuple[datetime, datetime]:
    window_end = _as_utc(anchor_time)
    return window_end - timedelta(minutes=minutes), window_end


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    index = max(0, ceil(len(sorted_values) * percentile) - 1)
    return float(sorted_values[index])


def _ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _upsert_metric(
    db: Session,
    *,
    scope: ReliabilityScope,
    metric_name: str,
    window_minutes: int,
    window_start: datetime,
    window_end: datetime,
    value_number: float,
    numerator: float | None,
    denominator: float | None,
    unit: str,
    computed_at: datetime,
    metadata_json: dict[str, Any] | None = None,
) -> ReliabilityMetric:
    metric = db.scalar(
        select(ReliabilityMetric).where(
            ReliabilityMetric.scope_type == scope.scope_type,
            ReliabilityMetric.scope_id == scope.scope_id,
            ReliabilityMetric.metric_name == metric_name,
            ReliabilityMetric.window_minutes == window_minutes,
            ReliabilityMetric.window_start == window_start,
            ReliabilityMetric.window_end == window_end,
        )
    )
    if metric is None:
        metric = ReliabilityMetric(
            organization_id=scope.organization_id,
            project_id=scope.project_id,
            scope_type=scope.scope_type,
            scope_id=scope.scope_id,
            metric_name=metric_name,
            window_minutes=window_minutes,
            window_start=window_start,
            window_end=window_end,
        )
    metric.value_number = value_number
    metric.numerator = numerator
    metric.denominator = denominator
    metric.unit = unit
    metric.computed_at = computed_at
    metric.metadata_json = metadata_json
    db.add(metric)
    db.flush()
    return metric


def _project_scope(project: Project) -> ReliabilityScope:
    return ReliabilityScope(
        organization_id=project.organization_id,
        project_id=project.id,
        scope_type=SCOPE_PROJECT,
        scope_id=str(project.id),
    )


def _trace_scope_filters(
    statement,
    *,
    scope: ReliabilityScope,
):
    if scope.scope_type == SCOPE_PROMPT_VERSION:
        return statement.where(Trace.prompt_version_record_id == UUID(scope.scope_id))
    if scope.scope_type == SCOPE_MODEL_VERSION:
        return statement.where(Trace.model_version_record_id == UUID(scope.scope_id))
    return statement


def _load_traces(
    db: Session,
    *,
    scope: ReliabilityScope,
    window_start: datetime,
    window_end: datetime,
    with_details: bool = False,
) -> list[Trace]:
    statement = select(Trace).where(
        Trace.organization_id == scope.organization_id,
        Trace.project_id == scope.project_id,
        Trace.created_at >= window_start,
        Trace.created_at < window_end,
    )
    statement = _trace_scope_filters(statement, scope=scope)
    if with_details:
        statement = statement.options(
            selectinload(Trace.evaluations),
            selectinload(Trace.retrieval_span),
            selectinload(Trace.prompt_version_record),
            selectinload(Trace.model_version_record),
        )
    return db.scalars(statement.order_by(desc(Trace.created_at), desc(Trace.id))).unique().all()


def _latest_rollup_metric(
    db: Session,
    *,
    project_id: UUID,
    scope_type: str,
    scope_id: str,
    metric_name: str,
    window_minutes: int,
    computed_before: datetime,
) -> EvaluationRollup | None:
    return db.scalar(
        select(EvaluationRollup)
        .where(
            EvaluationRollup.project_id == project_id,
            EvaluationRollup.scope_type == scope_type,
            EvaluationRollup.scope_id == scope_id,
            EvaluationRollup.metric_name == metric_name,
            EvaluationRollup.window_minutes == window_minutes,
            EvaluationRollup.window_end <= computed_before,
        )
        .order_by(desc(EvaluationRollup.window_end))
    )


def _load_structured_evaluation_by_trace(db: Session, trace_ids: list[UUID]) -> dict[UUID, Evaluation]:
    if not trace_ids:
        return {}
    rows = db.scalars(
        select(Evaluation).where(
            Evaluation.trace_id.in_(trace_ids),
            Evaluation.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE,
        )
    ).all()
    return {row.trace_id: row for row in rows}


def _compute_quality_metric_from_traces(
    db: Session,
    *,
    scope: ReliabilityScope,
    anchor_time: datetime,
    metric_name: str,
) -> ReliabilityMetric:
    window_start, window_end = _window(anchor_time, HOUR_MINUTES)
    traces = _load_traces(db, scope=scope, window_start=window_start, window_end=window_end)
    trace_ids = [trace.id for trace in traces]
    evaluation_by_trace = _load_structured_evaluation_by_trace(db, trace_ids)

    if metric_name == METRIC_QUALITY_PASS_RATE:
        numerator = float(sum(1 for trace in traces if trace.success))
        denominator = float(len(traces))
    else:
        structured_traces = [
            trace
            for trace in traces
            if trace.metadata_json
            and (
                trace.metadata_json.get("expected_output_format") == "json"
                or trace.metadata_json.get("structured_output") is True
                or trace.metadata_json.get("structured_output_schema") is not None
            )
        ]
        numerator = float(
            sum(
                1
                for trace in structured_traces
                if (evaluation_by_trace.get(trace.id) is not None)
                and evaluation_by_trace[trace.id].label == "pass"
            )
        )
        denominator = float(len(structured_traces))

    return _upsert_metric(
        db,
        scope=scope,
        metric_name=metric_name,
        window_minutes=HOUR_MINUTES,
        window_start=window_start,
        window_end=window_end,
        value_number=_ratio(numerator, denominator),
        numerator=numerator,
        denominator=denominator,
        unit="ratio",
        computed_at=anchor_time,
    )


def _store_quality_metrics_for_scope(
    db: Session,
    *,
    scope: ReliabilityScope,
    anchor_time: datetime,
) -> list[ReliabilityMetric]:
    if scope.scope_type in {SCOPE_PROJECT, SCOPE_PROMPT_VERSION}:
        scope_id = str(scope.project_id)
        if scope.scope_type == SCOPE_PROMPT_VERSION:
            prompt_version = db.get(PromptVersion, UUID(scope.scope_id))
            scope_id = prompt_version.version if prompt_version is not None else scope.scope_id
        metrics: list[ReliabilityMetric] = []
        for source_name, target_name in (
            ("success_rate", METRIC_QUALITY_PASS_RATE),
            ("structured_output_validity_pass_rate", METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE),
        ):
            rollup = _latest_rollup_metric(
                db,
                project_id=scope.project_id,
                scope_type=scope.scope_type,
                scope_id=scope_id,
                metric_name=source_name,
                window_minutes=HOUR_MINUTES,
                computed_before=anchor_time,
            )
            if rollup is None:
                metrics.append(
                    _compute_quality_metric_from_traces(
                        db,
                        scope=scope,
                        anchor_time=anchor_time,
                        metric_name=target_name,
                    )
                )
                continue
            numerator = float(rollup.metric_value) * float(rollup.sample_size)
            metrics.append(
                _upsert_metric(
                    db,
                    scope=scope,
                    metric_name=target_name,
                    window_minutes=HOUR_MINUTES,
                    window_start=rollup.window_start,
                    window_end=rollup.window_end,
                    value_number=float(rollup.metric_value),
                    numerator=numerator,
                    denominator=float(rollup.sample_size),
                    unit="ratio",
                    computed_at=anchor_time,
                    metadata_json={"source": "evaluation_rollups"},
                )
            )
        return metrics

    return [
        _compute_quality_metric_from_traces(
            db,
            scope=scope,
            anchor_time=anchor_time,
            metric_name=METRIC_QUALITY_PASS_RATE,
        ),
        _compute_quality_metric_from_traces(
            db,
            scope=scope,
            anchor_time=anchor_time,
            metric_name=METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
        ),
    ]


def _match_incident_to_snapshot(incident: Incident, snapshots_by_id: dict[UUID, RegressionSnapshot]) -> RegressionSnapshot | None:
    summary = incident.summary_json or {}
    snapshot_ids = summary.get("regression_snapshot_ids", [])
    for raw_snapshot_id in snapshot_ids:
        try:
            snapshot_id = UUID(str(raw_snapshot_id))
        except ValueError:
            continue
        if snapshot_id in snapshots_by_id:
            return snapshots_by_id[snapshot_id]
    return None


def _load_hourly_project_state(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
) -> dict[str, Any]:
    window_start, window_end = _window(anchor_time, HOUR_MINUTES)
    incident_events = db.scalars(
        select(IncidentEvent)
        .options(selectinload(IncidentEvent.incident))
        .where(
            IncidentEvent.created_at >= window_start,
            IncidentEvent.created_at < window_end,
            IncidentEvent.event_type.in_([INCIDENT_EVENT_OPENED, INCIDENT_EVENT_REOPENED]),
        )
        .order_by(desc(IncidentEvent.created_at))
    ).all()
    incident_events = [
        event
        for event in incident_events
        if event.incident is not None
        and event.incident.project_id == project.id
        and event.incident.organization_id == project.organization_id
    ]
    incidents = db.scalars(
        select(Incident).where(Incident.project_id == project.id, Incident.organization_id == project.organization_id)
    ).all()
    snapshots = db.scalars(
        select(RegressionSnapshot).where(
            RegressionSnapshot.project_id == project.id,
            RegressionSnapshot.organization_id == project.organization_id,
            RegressionSnapshot.detected_at >= window_start,
            RegressionSnapshot.detected_at < window_end,
        )
    ).all()
    alert_deliveries = db.scalars(
        select(AlertDelivery)
        .join(Incident, Incident.id == AlertDelivery.incident_id)
        .where(
            Incident.project_id == project.id,
            Incident.organization_id == project.organization_id,
            AlertDelivery.created_at >= window_start,
            AlertDelivery.created_at < window_end,
        )
    ).all()
    return {
        "window_start": window_start,
        "window_end": window_end,
        "incident_events": incident_events,
        "incidents": incidents,
        "snapshots": snapshots,
        "alert_deliveries": alert_deliveries,
    }


def _store_project_hourly_metrics(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
) -> list[ReliabilityMetric]:
    state = _load_hourly_project_state(db, project=project, anchor_time=anchor_time)
    scope = _project_scope(project)
    snapshots = state["snapshots"]
    snapshots_by_id = {snapshot.id: snapshot for snapshot in snapshots}
    breaching_snapshots = [snapshot for snapshot in snapshots if snapshot_breaches_any_rule(snapshot)]

    detection_latencies = []
    reopened_count = 0
    opened_or_reopened_count = 0
    for event in state["incident_events"]:
        if event.event_type == INCIDENT_EVENT_REOPENED:
            reopened_count += 1
        opened_or_reopened_count += 1
        if event.event_type != INCIDENT_EVENT_OPENED:
            continue
        snapshot = _match_incident_to_snapshot(event.incident, snapshots_by_id)
        if snapshot is None:
            continue
        latency = max(0.0, (event.created_at - snapshot.detected_at).total_seconds() / 60.0)
        detection_latencies.append(latency)

    acked_incidents = [
        incident
        for incident in state["incidents"]
        if incident.acknowledged_at is not None
        and state["window_start"] <= _as_utc(incident.acknowledged_at) < state["window_end"]
    ]
    resolved_incidents = [
        incident
        for incident in state["incidents"]
        if incident.resolved_at is not None
        and state["window_start"] <= _as_utc(incident.resolved_at) < state["window_end"]
    ]
    mtta_values = [
        max(0.0, (_as_utc(incident.acknowledged_at) - _as_utc(incident.started_at)).total_seconds() / 60.0)
        for incident in acked_incidents
        if incident.acknowledged_at is not None
    ]
    mttr_values = [
        max(0.0, (_as_utc(incident.resolved_at) - _as_utc(incident.started_at)).total_seconds() / 60.0)
        for incident in resolved_incidents
        if incident.resolved_at is not None
    ]
    false_positive_count = float(sum(1 for incident in resolved_incidents if incident.acknowledged_at is None))
    alert_terminal = [
        delivery
        for delivery in state["alert_deliveries"]
        if delivery.delivery_status in {ALERT_STATUS_SENT, ALERT_STATUS_FAILED}
    ]
    alert_sent_count = float(sum(1 for delivery in alert_terminal if delivery.delivery_status == ALERT_STATUS_SENT))
    covered_snapshot_count = 0.0
    for snapshot in breaching_snapshots:
        match = next(
            (
                incident
                for incident in state["incidents"]
                if incident.summary_json.get("metric_name") == snapshot.metric_name
                and incident.summary_json.get("scope_type") == snapshot.scope_type
                and incident.summary_json.get("scope_id") == snapshot.scope_id
            ),
            None,
        )
        if match is not None:
            covered_snapshot_count += 1.0

    metrics = [
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_INCIDENT_DETECTION_LATENCY_P90,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_percentile(detection_latencies, 0.90) or 0.0,
            numerator=float(sum(detection_latencies)) if detection_latencies else None,
            denominator=float(len(detection_latencies)),
            unit="minutes",
            computed_at=anchor_time,
        ),
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_MTTA_P90,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_percentile(mtta_values, 0.90) or 0.0,
            numerator=float(sum(mtta_values)) if mtta_values else None,
            denominator=float(len(mtta_values)),
            unit="minutes",
            computed_at=anchor_time,
        ),
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_MTTR_P90,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_percentile(mttr_values, 0.90) or 0.0,
            numerator=float(sum(mttr_values)) if mttr_values else None,
            denominator=float(len(mttr_values)),
            unit="minutes",
            computed_at=anchor_time,
        ),
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_INCIDENT_RECURRENCE_RATE,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_ratio(float(reopened_count), float(opened_or_reopened_count)),
            numerator=float(reopened_count),
            denominator=float(opened_or_reopened_count),
            unit="ratio",
            computed_at=anchor_time,
        ),
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_FALSE_POSITIVE_RATE,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_ratio(false_positive_count, float(len(resolved_incidents))),
            numerator=false_positive_count,
            denominator=float(len(resolved_incidents)),
            unit="ratio",
            computed_at=anchor_time,
        ),
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_ALERT_DELIVERY_SUCCESS_RATE,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_ratio(alert_sent_count, float(len(alert_terminal))),
            numerator=alert_sent_count,
            denominator=float(len(alert_terminal)),
            unit="ratio",
            computed_at=anchor_time,
        ),
        _upsert_metric(
            db,
            scope=scope,
            metric_name=METRIC_DETECTION_COVERAGE,
            window_minutes=HOUR_MINUTES,
            window_start=state["window_start"],
            window_end=state["window_end"],
            value_number=_ratio(covered_snapshot_count, float(len(breaching_snapshots))),
            numerator=covered_snapshot_count,
            denominator=float(len(breaching_snapshots)),
            unit="ratio",
            computed_at=anchor_time,
        ),
    ]
    return metrics


def _bad_trace_dimension_score(snapshot: RegressionSnapshot, traces: list[Trace]) -> tuple[float, dict[str, Any] | None]:
    if not traces:
        return 0.0, None
    bad_traces: list[Trace] = []
    if snapshot.metric_name == "success_rate":
        bad_traces = [trace for trace in traces if not trace.success]
    elif snapshot.metric_name == "structured_output_validity_pass_rate":
        for trace in traces:
            for evaluation in trace.evaluations:
                if evaluation.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE and evaluation.label == "fail":
                    bad_traces.append(trace)
                    break
    elif snapshot.metric_name == "p95_latency_ms":
        threshold = float(snapshot.baseline_value)
        bad_traces = [trace for trace in traces if trace.latency_ms is not None and trace.latency_ms >= threshold]
    elif snapshot.metric_name == "average_cost_usd_per_trace":
        threshold = float(snapshot.baseline_value)
        bad_traces = [
            trace for trace in traces if trace.total_cost_usd is not None and float(trace.total_cost_usd) >= threshold
        ]
    if not bad_traces:
        return 0.0, None

    top_score = 0.0
    top_metadata: dict[str, Any] | None = None
    for dimension, extractor in (
        ("prompt_version", lambda trace: trace.prompt_version or "unversioned"),
        ("model_name", lambda trace: trace.model_name),
    ):
        counter = Counter(extractor(trace) for trace in bad_traces)
        value, count = counter.most_common(1)[0]
        score = count / len(bad_traces)
        if score > top_score:
            top_score = score
            top_metadata = {
                "dimension": dimension,
                "value": value,
                "bad_count": count,
                "total_bad": len(bad_traces),
                "metric_name": snapshot.metric_name,
            }
    return top_score, top_metadata


def _store_root_cause_localization_metric(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
) -> ReliabilityMetric:
    scope = _project_scope(project)
    window_start, window_end = _window(anchor_time, HOUR_MINUTES)
    snapshots = db.scalars(
        select(RegressionSnapshot).where(
            RegressionSnapshot.project_id == project.id,
            RegressionSnapshot.organization_id == project.organization_id,
            RegressionSnapshot.detected_at >= window_start,
            RegressionSnapshot.detected_at < window_end,
        )
    ).all()

    top_score = 0.0
    top_metadata = None
    for snapshot in snapshots:
        if not snapshot_breaches_any_rule(snapshot):
            continue
        metadata = snapshot.metadata_json or {}
        current_start = metadata.get("current_window_start")
        current_end = metadata.get("current_window_end")
        if current_start is None or current_end is None:
            continue
        traces = db.scalars(
            select(Trace)
            .options(selectinload(Trace.evaluations))
            .where(
                Trace.organization_id == project.organization_id,
                Trace.project_id == project.id,
                Trace.timestamp >= datetime.fromisoformat(current_start),
                Trace.timestamp < datetime.fromisoformat(current_end),
            )
        ).unique().all()
        if snapshot.scope_type == SCOPE_PROMPT_VERSION:
            traces = [trace for trace in traces if trace.prompt_version == snapshot.scope_id]
        score, metadata_json = _bad_trace_dimension_score(snapshot, traces)
        if score > top_score:
            top_score = score
            top_metadata = metadata_json

    return _upsert_metric(
        db,
        scope=scope,
        metric_name=METRIC_ROOT_CAUSE_LOCALIZATION_SCORE,
        window_minutes=HOUR_MINUTES,
        window_start=window_start,
        window_end=window_end,
        value_number=top_score,
        numerator=top_metadata.get("bad_count") if top_metadata else 0.0,
        denominator=top_metadata.get("total_bad") if top_metadata else 0.0,
        unit="ratio",
        computed_at=anchor_time,
        metadata_json=top_metadata,
    )


def _store_telemetry_freshness_metric(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
) -> ReliabilityMetric:
    scope = _project_scope(project)
    window_start, window_end = _window(anchor_time, HOUR_MINUTES)
    freshness_minutes = None
    if project.last_trace_received_at is not None:
        freshness_minutes = max(
            0.0,
            (_as_utc(anchor_time) - _as_utc(project.last_trace_received_at)).total_seconds() / 60.0,
        )
    return _upsert_metric(
        db,
        scope=scope,
        metric_name=METRIC_TELEMETRY_FRESHNESS_MINUTES,
        window_minutes=HOUR_MINUTES,
        window_start=window_start,
        window_end=window_end,
        value_number=freshness_minutes or 0.0,
        numerator=freshness_minutes,
        denominator=1.0 if freshness_minutes is not None else 0.0,
        unit="minutes",
        computed_at=anchor_time,
        metadata_json={"last_trace_received_at": project.last_trace_received_at.isoformat() if project.last_trace_received_at else None},
    )


def _store_explainability_metric(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
) -> ReliabilityMetric:
    scope = _project_scope(project)
    window_start, window_end = _window(anchor_time, DAY_MINUTES)
    traces = _load_traces(db, scope=scope, window_start=window_start, window_end=window_end)
    explainable_count = float(sum(1 for trace in traces if trace.is_explainable))
    return _upsert_metric(
        db,
        scope=scope,
        metric_name=METRIC_EXPLAINABILITY_SCORE,
        window_minutes=DAY_MINUTES,
        window_start=window_start,
        window_end=window_end,
        value_number=_ratio(explainable_count, float(len(traces))),
        numerator=explainable_count,
        denominator=float(len(traces)),
        unit="ratio",
        computed_at=anchor_time,
    )


def _store_incident_density_metric(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
) -> ReliabilityMetric:
    scope = _project_scope(project)
    window_start, window_end = _window(anchor_time, WEEK_MINUTES)
    incident_count = float(
        len(
            db.scalars(
                select(IncidentEvent)
                .join(Incident, Incident.id == IncidentEvent.incident_id)
                .where(
                    Incident.project_id == project.id,
                    Incident.organization_id == project.organization_id,
                    IncidentEvent.event_type == INCIDENT_EVENT_OPENED,
                    IncidentEvent.created_at >= window_start,
                    IncidentEvent.created_at < window_end,
                )
            ).all()
        )
    )
    trace_count = float(
        len(
            db.scalars(
                select(Trace.id).where(
                    Trace.project_id == project.id,
                    Trace.organization_id == project.organization_id,
                    Trace.created_at >= window_start,
                    Trace.created_at < window_end,
                )
            ).all()
        )
    )
    denominator = trace_count / 10000.0 if trace_count > 0 else 0.0
    return _upsert_metric(
        db,
        scope=scope,
        metric_name=METRIC_INCIDENT_DENSITY,
        window_minutes=WEEK_MINUTES,
        window_start=window_start,
        window_end=window_end,
        value_number=(incident_count / denominator) if denominator > 0 else 0.0,
        numerator=incident_count,
        denominator=denominator,
        unit="incidents_per_10k_traces",
        computed_at=anchor_time,
        metadata_json={"trace_count": trace_count, "opened_incident_count": incident_count},
    )


def compute_project_reliability_metrics(
    db: Session,
    *,
    project: Project,
    anchor_time: datetime,
    prompt_version_record_id: UUID | None = None,
    model_version_record_id: UUID | None = None,
) -> list[ReliabilityMetric]:
    metrics = _store_project_hourly_metrics(db, project=project, anchor_time=anchor_time)
    metrics.append(_store_telemetry_freshness_metric(db, project=project, anchor_time=anchor_time))
    metrics.append(_store_explainability_metric(db, project=project, anchor_time=anchor_time))
    metrics.append(_store_incident_density_metric(db, project=project, anchor_time=anchor_time))
    metrics.append(_store_root_cause_localization_metric(db, project=project, anchor_time=anchor_time))
    metrics.extend(_store_quality_metrics_for_scope(db, scope=_project_scope(project), anchor_time=anchor_time))

    if prompt_version_record_id is not None:
        metrics.extend(
            _store_quality_metrics_for_scope(
                db,
                scope=ReliabilityScope(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    scope_type=SCOPE_PROMPT_VERSION,
                    scope_id=str(prompt_version_record_id),
                ),
                anchor_time=anchor_time,
            )
        )
    if model_version_record_id is not None:
        metrics.extend(
            _store_quality_metrics_for_scope(
                db,
                scope=ReliabilityScope(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    scope_type=SCOPE_MODEL_VERSION,
                    scope_id=str(model_version_record_id),
                ),
                anchor_time=anchor_time,
            )
        )
    return metrics


def latest_project_reliability_metrics(db: Session, *, project_id: UUID) -> dict[str, ReliabilityMetric]:
    rows = db.scalars(
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == project_id,
            ReliabilityMetric.scope_type == SCOPE_PROJECT,
            ReliabilityMetric.scope_id == str(project_id),
        )
        .order_by(desc(ReliabilityMetric.window_end), desc(ReliabilityMetric.created_at))
    ).all()
    latest: dict[str, ReliabilityMetric] = {}
    for row in rows:
        latest.setdefault(row.metric_name, row)
    return latest


def project_reliability_trends(
    db: Session,
    *,
    project_id: UUID,
    metric_names: list[str],
    limit: int = 12,
) -> dict[str, list[ReliabilityMetric]]:
    trends: dict[str, list[ReliabilityMetric]] = {}
    for metric_name in metric_names:
        rows = db.scalars(
            select(ReliabilityMetric)
            .where(
                ReliabilityMetric.project_id == project_id,
                ReliabilityMetric.scope_type == SCOPE_PROJECT,
                ReliabilityMetric.scope_id == str(project_id),
                ReliabilityMetric.metric_name == metric_name,
            )
            .order_by(desc(ReliabilityMetric.window_end), desc(ReliabilityMetric.created_at))
            .limit(limit)
        ).all()
        trends[metric_name] = list(reversed(rows))
    return trends


def compute_reliability_score(metric_values: dict[str, float | None]) -> float | None:
    checks: list[float] = []
    for metric_name, (operator, threshold) in SCORECARD_METRIC_TARGETS.items():
        value = metric_values.get(metric_name)
        if value is None:
            continue
        if operator == "max":
            checks.append(1.0 if value <= threshold else 0.0)
        else:
            checks.append(1.0 if value >= threshold else 0.0)
    if not checks:
        return None
    return sum(checks) / len(checks)
