from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.evaluation_rollup import EvaluationRollup
from app.models.incident import Incident
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.schemas.regression import RegressionListQuery
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.incidents import (
    build_cohort_pivots,
    derive_dimension_summaries,
    derive_registry_contexts,
    derive_root_cause_hints,
)
from app.services.evaluations import trace_refusal_detected
from app.services.rollups import (
    RollupScope,
    build_baseline_window,
    build_current_window,
    compute_rollups_for_scope,
    list_rollup_metrics_for_project,
    quantize_decimal,
)

INCIDENT_WINDOW_MINUTES = 60


@dataclass(frozen=True)
class RegressionComputationResult:
    scope: RollupScope
    snapshots: list[RegressionSnapshot]


@dataclass(frozen=True)
class RegressionDetailResult:
    regression: RegressionSnapshot
    related_incident: Incident | None
    current_representative_traces: list[Trace]
    baseline_representative_traces: list[Trace]
    root_cause_hints: list[dict]
    dimension_summaries: list[dict]
    prompt_version_contexts: list[dict]
    model_version_contexts: list[dict]
    cohort_pivots: list[dict]


@dataclass(frozen=True)
class RegressionCompareResult:
    regression: RegressionSnapshot
    related_incident: Incident | None
    current_representative_traces: list[Trace]
    baseline_representative_traces: list[Trace]
    dimension_summaries: list[dict]
    prompt_version_contexts: list[dict]
    model_version_contexts: list[dict]
    cohort_pivots: list[dict]


def _baseline_rollup(
    db: Session, *, scope: RollupScope, metric_name: str, baseline_window
) -> EvaluationRollup:
    record = db.scalar(
        select(EvaluationRollup).where(
            EvaluationRollup.scope_type == scope.scope_type,
            EvaluationRollup.scope_id == scope.scope_id,
            EvaluationRollup.metric_name == metric_name,
            EvaluationRollup.window_minutes == baseline_window.minutes,
        )
    )
    if record and record.window_start == baseline_window.start and record.window_end == baseline_window.end:
        return record

    baseline_map = compute_rollups_for_scope(db, scope=scope, anchor_time=baseline_window.end)
    return baseline_map[baseline_window.minutes][metric_name]


def compute_regressions_for_scope(
    db: Session,
    *,
    scope: RollupScope,
    anchor_time: datetime,
) -> RegressionComputationResult:
    current_rollups = compute_rollups_for_scope(db, scope=scope, anchor_time=anchor_time)
    current_window = build_current_window(anchor_time, INCIDENT_WINDOW_MINUTES)
    baseline_window = build_baseline_window(current_window)
    snapshots: list[RegressionSnapshot] = []

    for metric_name in list_rollup_metrics_for_project(db, project_id=scope.project_id):
        current_rollup = current_rollups[INCIDENT_WINDOW_MINUTES][metric_name]
        baseline_rollup = _baseline_rollup(
            db, scope=scope, metric_name=metric_name, baseline_window=baseline_window
        )
        delta_absolute = quantize_decimal(current_rollup.metric_value - baseline_rollup.metric_value)
        if baseline_rollup.metric_value == 0:
            delta_percent = None
        else:
            delta_percent = quantize_decimal(delta_absolute / baseline_rollup.metric_value)

        snapshot = db.scalar(
            select(RegressionSnapshot).where(
                RegressionSnapshot.scope_type == scope.scope_type,
                RegressionSnapshot.scope_id == scope.scope_id,
                RegressionSnapshot.metric_name == metric_name,
                RegressionSnapshot.window_minutes == INCIDENT_WINDOW_MINUTES,
            )
        )
        if snapshot is None:
            snapshot = RegressionSnapshot(
                organization_id=scope.organization_id,
                project_id=scope.project_id,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
                metric_name=metric_name,
                window_minutes=INCIDENT_WINDOW_MINUTES,
            )

        snapshot.current_value = current_rollup.metric_value
        snapshot.baseline_value = baseline_rollup.metric_value
        snapshot.delta_absolute = delta_absolute
        snapshot.delta_percent = delta_percent
        snapshot.detected_at = anchor_time
        snapshot.metadata_json = {
            "current_window_start": current_window.start.isoformat(),
            "current_window_end": current_window.end.isoformat(),
            "baseline_window_start": baseline_window.start.isoformat(),
            "baseline_window_end": baseline_window.end.isoformat(),
            "current_sample_size": current_rollup.sample_size,
            "baseline_sample_size": baseline_rollup.sample_size,
        }
        db.add(snapshot)
        db.flush()
        snapshots.append(snapshot)

    return RegressionComputationResult(scope=scope, snapshots=snapshots)


def list_project_regressions(
    db: Session,
    operator: OperatorContext,
    *,
    project_id: UUID,
    query: RegressionListQuery,
) -> list[RegressionSnapshot]:
    require_project_access(db, operator, project_id)
    statement = (
        select(RegressionSnapshot)
        .where(
            RegressionSnapshot.project_id == project_id,
            RegressionSnapshot.organization_id.in_(operator.organization_ids),
        )
        .order_by(desc(RegressionSnapshot.detected_at), RegressionSnapshot.metric_name)
    )
    if query.metric_name is not None:
        statement = statement.where(RegressionSnapshot.metric_name == query.metric_name)
    if query.scope_id is not None:
        statement = statement.where(RegressionSnapshot.scope_id == query.scope_id)
    statement = statement.limit(query.limit)
    return db.scalars(statement).all()


def _window_datetime(metadata: dict, key: str) -> datetime | None:
    value = metadata.get(key)
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _load_regression_window_traces(
    db: Session,
    *,
    regression: RegressionSnapshot,
    metadata: dict,
    window_start_key: str,
    window_end_key: str,
) -> list[Trace]:
    window_start = _window_datetime(metadata, window_start_key)
    window_end = _window_datetime(metadata, window_end_key)
    if window_start is None or window_end is None:
        return []
    statement = (
        select(Trace)
        .options(
            selectinload(Trace.retrieval_span),
            selectinload(Trace.evaluations),
            selectinload(Trace.prompt_version_record),
            selectinload(Trace.model_version_record),
        )
        .where(
            Trace.organization_id == regression.organization_id,
            Trace.project_id == regression.project_id,
            Trace.timestamp >= window_start,
            Trace.timestamp < window_end,
        )
        .order_by(desc(Trace.timestamp), desc(Trace.id))
    )
    if regression.scope_type == "prompt_version":
        statement = statement.where(Trace.prompt_version == regression.scope_id)
    return db.scalars(statement).all()


def _regression_sort_key(metric_name: str, trace: Trace, *, window_kind: str) -> tuple:
    if metric_name == "success_rate":
        return ((1 if not trace.success else 0) if window_kind == "current" else (1 if trace.success else 0), trace.timestamp)
    if metric_name == "structured_output_validity_pass_rate":
        structured_fail = any(
            evaluation.eval_type == "structured_validity" and evaluation.label == "fail"
            for evaluation in getattr(trace, "evaluations", [])
        )
        structured_pass = any(
            evaluation.eval_type == "structured_validity" and evaluation.label == "pass"
            for evaluation in getattr(trace, "evaluations", [])
        )
        primary = structured_fail if window_kind == "current" else structured_pass
        secondary = 1 if not trace.success else 0
        return (1 if primary else 0, secondary, trace.timestamp)
    if metric_name == "average_cost_usd_per_trace":
        return (trace.total_cost_usd or Decimal("0"), trace.timestamp)
    if metric_name == "refusal_rate":
        detected = 1 if trace_refusal_detected(trace) else 0
        primary = detected if window_kind == "current" else (1 - detected)
        return (primary, trace.timestamp)
    return (trace.latency_ms or 0, trace.timestamp)


def get_regression_detail(
    db: Session,
    operator: OperatorContext,
    *,
    regression_id: UUID,
) -> RegressionDetailResult:
    regression = db.get(RegressionSnapshot, regression_id)
    if regression is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regression not found")
    require_project_access(db, operator, regression.project_id)

    candidate_incidents = db.scalars(
        select(Incident).where(
            Incident.project_id == regression.project_id,
            Incident.organization_id.in_(operator.organization_ids),
        )
    ).all()
    related_incident = None
    for candidate in candidate_incidents:
        snapshot_ids = set(candidate.summary_json.get("regression_snapshot_ids", []))
        if str(regression.id) in snapshot_ids:
            related_incident = candidate
            break
        if (
            candidate.summary_json.get("metric_name") == regression.metric_name
            and candidate.summary_json.get("scope_type") == regression.scope_type
            and candidate.summary_json.get("scope_id") == regression.scope_id
        ):
            related_incident = candidate

    metadata = regression.metadata_json or {}
    current_traces = _load_regression_window_traces(
        db,
        regression=regression,
        metadata=metadata,
        window_start_key="current_window_start",
        window_end_key="current_window_end",
    )
    baseline_traces = _load_regression_window_traces(
        db,
        regression=regression,
        metadata=metadata,
        window_start_key="baseline_window_start",
        window_end_key="baseline_window_end",
    )
    current_sorted = sorted(
        current_traces,
        key=lambda trace: _regression_sort_key(regression.metric_name, trace, window_kind="current"),
        reverse=True,
    )
    baseline_sorted = sorted(
        baseline_traces,
        key=lambda trace: _regression_sort_key(regression.metric_name, trace, window_kind="baseline"),
        reverse=True,
    )

    current_window_start = _window_datetime(metadata, "current_window_start")
    current_window_end = _window_datetime(metadata, "current_window_end")
    dimension_summaries = derive_dimension_summaries(
        current_traces=current_sorted,
        baseline_traces=baseline_sorted,
    )
    cohort_pivots = build_cohort_pivots(
        project_id=regression.project_id,
        scope_type=regression.scope_type,
        scope_id=regression.scope_id,
        current_window_start=current_window_start,
        current_window_end=current_window_end,
        anchor_time=related_incident.started_at if related_incident is not None else regression.detected_at,
        current_traces=current_sorted,
    )
    prompt_version_contexts, model_version_contexts = derive_registry_contexts(
        project_id=regression.project_id,
        current_traces=current_sorted,
        baseline_traces=baseline_sorted,
    )

    return RegressionDetailResult(
        regression=regression,
        related_incident=related_incident,
        current_representative_traces=current_sorted[:5],
        baseline_representative_traces=baseline_sorted[:5],
        root_cause_hints=derive_root_cause_hints(
            incident=related_incident,
            current_traces=current_sorted,
            baseline_traces=baseline_sorted,
        )
        if current_sorted or baseline_sorted
        else [],
        dimension_summaries=dimension_summaries,
        prompt_version_contexts=prompt_version_contexts,
        model_version_contexts=model_version_contexts,
        cohort_pivots=cohort_pivots,
    )


def get_regression_compare(
    db: Session,
    operator: OperatorContext,
    *,
    regression_id: UUID,
) -> RegressionCompareResult:
    result = get_regression_detail(db, operator, regression_id=regression_id)
    return RegressionCompareResult(
        regression=result.regression,
        related_incident=result.related_incident,
        current_representative_traces=result.current_representative_traces,
        baseline_representative_traces=result.baseline_representative_traces,
        dimension_summaries=result.dimension_summaries,
        prompt_version_contexts=result.prompt_version_contexts,
        model_version_contexts=result.model_version_contexts,
        cohort_pivots=result.cohort_pivots,
    )


def get_regression_history(
    db: Session,
    operator: OperatorContext,
    *,
    project_id: UUID,
    regression_id: UUID,
    limit: int = 30,
) -> tuple[RegressionSnapshot, list[EvaluationRollup]]:
    require_project_access(db, operator, project_id)
    regression = db.scalar(
        select(RegressionSnapshot).where(
            RegressionSnapshot.id == regression_id,
            RegressionSnapshot.project_id == project_id,
        )
    )
    if regression is None:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Regression not found")
    points = db.scalars(
        select(EvaluationRollup)
        .where(
            EvaluationRollup.project_id == project_id,
            EvaluationRollup.scope_type == regression.scope_type,
            EvaluationRollup.scope_id == regression.scope_id,
            EvaluationRollup.metric_name == regression.metric_name,
            EvaluationRollup.window_minutes == regression.window_minutes,
        )
        .order_by(EvaluationRollup.window_start)
        .limit(limit)
    ).all()
    return regression, list(points)
