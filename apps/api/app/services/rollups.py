from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from math import ceil
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation
from app.models.project_custom_metric import ProjectCustomMetric
from app.models.evaluation_rollup import EvaluationRollup
from app.models.trace import Trace
from app.services.custom_metrics import (
    custom_metric_eval_type,
    custom_metric_rollup_name,
    list_enabled_project_custom_metrics,
    metric_hit_from_evaluation_raw,
    metric_value_from_evaluation_raw,
)
from app.services.evaluations import REFUSAL_DETECTION_EVAL_TYPE, STRUCTURED_VALIDITY_EVAL_TYPE

ROLLUP_WINDOW_MINUTES = (60, 360, 1440)
ROLLUP_METRICS = (
    "structured_output_validity_pass_rate",
    "success_rate",
    "refusal_rate",
    "median_latency_ms",
    "p95_latency_ms",
    "average_cost_usd_per_trace",
)
SCOPE_PROJECT = "project"
SCOPE_PROMPT_VERSION = "prompt_version"
PERCENT_SCALE = Decimal("0.000001")


@dataclass(frozen=True)
class RollupScope:
    organization_id: UUID
    project_id: UUID
    scope_type: str
    scope_id: str
    prompt_version: str | None = None


@dataclass(frozen=True)
class WindowDefinition:
    start: datetime
    end: datetime
    minutes: int


@dataclass(frozen=True)
class WindowRollup:
    scope: RollupScope
    metric_name: str
    window: WindowDefinition
    sample_size: int
    metric_value: Decimal
    metadata_json: dict | None


def quantize_decimal(value: Decimal | int | float | str | None) -> Decimal:
    raw = Decimal("0") if value is None else Decimal(str(value))
    return raw.quantize(PERCENT_SCALE, rounding=ROUND_HALF_UP)


def build_scopes(trace: Trace) -> list[RollupScope]:
    scopes = [
        RollupScope(
            organization_id=trace.organization_id,
            project_id=trace.project_id,
            scope_type=SCOPE_PROJECT,
            scope_id=str(trace.project_id),
        )
    ]
    if trace.prompt_version:
        scopes.append(
            RollupScope(
                organization_id=trace.organization_id,
                project_id=trace.project_id,
                scope_type=SCOPE_PROMPT_VERSION,
                scope_id=trace.prompt_version,
                prompt_version=trace.prompt_version,
            )
        )
    return scopes


def build_current_window(anchor: datetime, window_minutes: int) -> WindowDefinition:
    anchor_utc = anchor.replace(tzinfo=timezone.utc) if anchor.tzinfo is None else anchor.astimezone(timezone.utc)
    end = anchor_utc + timedelta(microseconds=1)
    start = end - timedelta(minutes=window_minutes)
    return WindowDefinition(start=start, end=end, minutes=window_minutes)


def build_baseline_window(current_window: WindowDefinition) -> WindowDefinition:
    return WindowDefinition(
        start=current_window.start - timedelta(minutes=current_window.minutes),
        end=current_window.start,
        minutes=current_window.minutes,
    )


def _matches_scope(trace: Trace, scope: RollupScope) -> bool:
    if trace.project_id != scope.project_id:
        return False
    if scope.scope_type == SCOPE_PROMPT_VERSION:
        return trace.prompt_version == scope.prompt_version
    return True


def _percentile(values: list[int], percentile: float) -> Decimal:
    if not values:
        return Decimal("0")
    sorted_values = sorted(values)
    index = max(0, ceil(len(sorted_values) * percentile) - 1)
    return quantize_decimal(sorted_values[index])


def _median(values: list[int]) -> Decimal:
    if not values:
        return Decimal("0")
    sorted_values = sorted(values)
    midpoint = len(sorted_values) // 2
    if len(sorted_values) % 2:
        return quantize_decimal(sorted_values[midpoint])
    return quantize_decimal((Decimal(sorted_values[midpoint - 1]) + Decimal(sorted_values[midpoint])) / 2)


def _compute_metric_rows(
    scope: RollupScope,
    window: WindowDefinition,
    traces: list[Trace],
    evaluations_by_trace_id: dict[UUID, list[Evaluation]],
    custom_metrics: list[ProjectCustomMetric],
) -> list[WindowRollup]:
    scoped_traces = [trace for trace in traces if _matches_scope(trace, scope)]
    latency_values = [trace.latency_ms for trace in scoped_traces if trace.latency_ms is not None]
    cost_values = [trace.total_cost_usd for trace in scoped_traces if trace.total_cost_usd is not None]
    structured_traces = [
        trace
        for trace in scoped_traces
        if trace.metadata_json
        and (
            trace.metadata_json.get("expected_output_format") == "json"
            or trace.metadata_json.get("structured_output") is True
            or trace.metadata_json.get("structured_output_schema") is not None
        )
    ]
    structured_passes = 0
    for trace in structured_traces:
        evaluation = next(
            (
                item
                for item in evaluations_by_trace_id.get(trace.id, [])
                if item.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE
            ),
            None,
        )
        if evaluation and (evaluation.label == "pass" or (evaluation.score or Decimal("0")) >= Decimal("50")):
            structured_passes += 1

    refusal_count = 0
    for trace in scoped_traces:
        evaluation = next(
            (
                item
                for item in evaluations_by_trace_id.get(trace.id, [])
                if item.eval_type == REFUSAL_DETECTION_EVAL_TYPE
            ),
            None,
        )
        if evaluation and metric_hit_from_evaluation_raw(evaluation.raw_result_json):
            refusal_count += 1

    success_count = sum(1 for trace in scoped_traces if trace.success)
    success_rate = (
        Decimal(success_count) / Decimal(len(scoped_traces)) if scoped_traces else Decimal("0")
    )
    structured_pass_rate = (
        Decimal(structured_passes) / Decimal(len(structured_traces)) if structured_traces else Decimal("0")
    )
    average_cost = (
        sum((Decimal(str(value)) for value in cost_values), start=Decimal("0")) / Decimal(len(cost_values))
        if cost_values
        else Decimal("0")
    )
    refusal_rate = (
        Decimal(refusal_count) / Decimal(len(scoped_traces)) if scoped_traces else Decimal("0")
    )

    rows = [
        WindowRollup(
            scope=scope,
            metric_name="structured_output_validity_pass_rate",
            window=window,
            sample_size=len(structured_traces),
            metric_value=quantize_decimal(structured_pass_rate),
            metadata_json={"trace_count": len(structured_traces)},
        ),
        WindowRollup(
            scope=scope,
            metric_name="success_rate",
            window=window,
            sample_size=len(scoped_traces),
            metric_value=quantize_decimal(success_rate),
            metadata_json={"trace_count": len(scoped_traces)},
        ),
        WindowRollup(
            scope=scope,
            metric_name="refusal_rate",
            window=window,
            sample_size=len(scoped_traces),
            metric_value=quantize_decimal(refusal_rate),
            metadata_json={"trace_count": len(scoped_traces), "refusal_count": refusal_count},
        ),
        WindowRollup(
            scope=scope,
            metric_name="median_latency_ms",
            window=window,
            sample_size=len(latency_values),
            metric_value=_median(latency_values),
            metadata_json={"trace_count": len(latency_values)},
        ),
        WindowRollup(
            scope=scope,
            metric_name="p95_latency_ms",
            window=window,
            sample_size=len(latency_values),
            metric_value=_percentile(latency_values, 0.95),
            metadata_json={"trace_count": len(latency_values)},
        ),
        WindowRollup(
            scope=scope,
            metric_name="average_cost_usd_per_trace",
            window=window,
            sample_size=len(cost_values),
            metric_value=quantize_decimal(average_cost),
            metadata_json={"trace_count": len(cost_values)},
        ),
    ]

    for metric in custom_metrics:
        eval_type = custom_metric_eval_type(metric)
        values: list[float] = []
        hits = 0
        for trace in scoped_traces:
            evaluation = next(
                (
                    item
                    for item in evaluations_by_trace_id.get(trace.id, [])
                    if item.eval_type == eval_type
                ),
                None,
            )
            if evaluation is None:
                continue
            value = metric_value_from_evaluation_raw(evaluation.raw_result_json)
            if value is None:
                continue
            values.append(value)
            if value > 0:
                hits += 1

        if metric.value_mode == "boolean":
            metric_value = Decimal(hits) / Decimal(len(scoped_traces)) if scoped_traces else Decimal("0")
            metadata = {"trace_count": len(scoped_traces), "hit_count": hits, "mode": "boolean"}
        else:
            metric_value = (
                Decimal(str(sum(values))) / Decimal(len(scoped_traces)) if scoped_traces else Decimal("0")
            )
            metadata = {"trace_count": len(scoped_traces), "match_count": sum(values), "mode": "count"}

        rows.append(
            WindowRollup(
                scope=scope,
                metric_name=custom_metric_rollup_name(metric),
                window=window,
                sample_size=len(scoped_traces),
                metric_value=quantize_decimal(metric_value),
                metadata_json=metadata,
            )
        )

    return rows


def _fetch_window_data(db: Session, scope: RollupScope, window: WindowDefinition) -> tuple[list[Trace], dict[UUID, list[Evaluation]]]:
    trace_statement = select(Trace).where(
        Trace.organization_id == scope.organization_id,
        Trace.project_id == scope.project_id,
        Trace.timestamp >= window.start,
        Trace.timestamp < window.end,
    )
    if scope.scope_type == SCOPE_PROMPT_VERSION:
        trace_statement = trace_statement.where(Trace.prompt_version == scope.prompt_version)
    traces = db.scalars(trace_statement).all()
    trace_ids = [trace.id for trace in traces]
    if not trace_ids:
        return [], {}

    evaluations = db.scalars(select(Evaluation).where(Evaluation.trace_id.in_(trace_ids))).all()
    evaluations_by_trace_id: dict[UUID, list[Evaluation]] = {}
    for evaluation in evaluations:
        evaluations_by_trace_id.setdefault(evaluation.trace_id, []).append(evaluation)
    return traces, evaluations_by_trace_id


def list_rollup_metrics_for_project(db: Session, *, project_id: UUID) -> tuple[str, ...]:
    custom_metrics = list_enabled_project_custom_metrics(db, project_id=project_id)
    return ROLLUP_METRICS + tuple(custom_metric_rollup_name(metric) for metric in custom_metrics)


def compute_rollups_for_scope(
    db: Session, *, scope: RollupScope, anchor_time: datetime
) -> dict[int, dict[str, EvaluationRollup]]:
    custom_metrics = list_enabled_project_custom_metrics(db, project_id=scope.project_id)
    rollups_by_window: dict[int, dict[str, EvaluationRollup]] = {}
    for window_minutes in ROLLUP_WINDOW_MINUTES:
        window = build_current_window(anchor_time, window_minutes)
        traces, evaluations_by_trace_id = _fetch_window_data(db, scope, window)
        computed_rows = _compute_metric_rows(
            scope,
            window,
            traces,
            evaluations_by_trace_id,
            custom_metrics,
        )
        metric_map: dict[str, EvaluationRollup] = {}
        for row in computed_rows:
            record = db.scalar(
                select(EvaluationRollup).where(
                    EvaluationRollup.scope_type == row.scope.scope_type,
                    EvaluationRollup.scope_id == row.scope.scope_id,
                    EvaluationRollup.metric_name == row.metric_name,
                    EvaluationRollup.window_minutes == row.window.minutes,
                    EvaluationRollup.window_start == row.window.start,
                    EvaluationRollup.window_end == row.window.end,
                )
            )
            if record is None:
                record = EvaluationRollup(
                    organization_id=row.scope.organization_id,
                    project_id=row.scope.project_id,
                    scope_type=row.scope.scope_type,
                    scope_id=row.scope.scope_id,
                    metric_name=row.metric_name,
                    window_minutes=row.window.minutes,
                )
            record.window_start = row.window.start
            record.window_end = row.window.end
            record.sample_size = row.sample_size
            record.metric_value = row.metric_value
            record.metadata_json = row.metadata_json
            db.add(record)
            db.flush()
            metric_map[row.metric_name] = record
        rollups_by_window[window_minutes] = metric_map
    return rollups_by_window
