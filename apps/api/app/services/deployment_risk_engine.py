from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.evaluation_rollup import EvaluationRollup
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE
from app.services.global_reliability_patterns import check_global_patterns
from app.services.reliability_graph import get_model_failure_graph
from app.services.reliability_pattern_mining import build_prompt_pattern_hash, get_pattern_risk

RISK_LEVEL_LOW = "low"
RISK_LEVEL_MEDIUM = "medium"
RISK_LEVEL_HIGH = "high"

WINDOW_MINUTES = 60
SIGNAL_WEIGHTS = {
    "structured_output_delta": 0.35,
    "latency_delta": 0.25,
    "error_rate_delta": 0.25,
    "regression_signal": 0.15,
}


@dataclass(frozen=True)
class TraceWindowStats:
    trace_count: int
    error_rate: float
    structured_validity_rate: float
    evaluation_failure_rate: float
    p95_latency_ms: float


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _percentile(values: list[int], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = max(0, ceil(len(sorted_values) * percentile) - 1)
    return float(sorted_values[index])


def _clamp(value: float) -> float:
    return max(0.0, min(value, 1.0))


def _trace_window_query(
    db: Session,
    *,
    deployment: Deployment,
    window_start: datetime,
    window_end: datetime,
) -> list[Trace]:
    statement = (
        select(Trace)
        .options(selectinload(Trace.evaluations))
        .where(
            Trace.project_id == deployment.project_id,
            Trace.timestamp >= window_start,
            Trace.timestamp < window_end,
        )
        .order_by(desc(Trace.timestamp), desc(Trace.id))
    )
    if deployment.prompt_version_id is not None:
        statement = statement.where(Trace.prompt_version_record_id == deployment.prompt_version_id)
    if deployment.model_version_id is not None:
        statement = statement.where(Trace.model_version_record_id == deployment.model_version_id)
    return db.scalars(statement).unique().all()


def _window_stats(traces: list[Trace]) -> TraceWindowStats:
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
    evaluation_failures = 0
    structured_passes = 0
    for trace in structured_traces:
        structured_evaluation = next(
            (item for item in trace.evaluations if item.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE),
            None,
        )
        if structured_evaluation is None:
            continue
        if structured_evaluation.label == "pass":
            structured_passes += 1
        else:
            evaluation_failures += 1

    latency_values = [trace.latency_ms for trace in traces if trace.latency_ms is not None]
    total = len(traces)
    structured_total = len(structured_traces)
    failures = sum(1 for trace in traces if not trace.success)
    return TraceWindowStats(
        trace_count=total,
        error_rate=(failures / total) if total else 0.0,
        structured_validity_rate=(structured_passes / structured_total) if structured_total else 0.0,
        evaluation_failure_rate=(evaluation_failures / structured_total) if structured_total else 0.0,
        p95_latency_ms=_percentile(latency_values, 0.95),
    )


def _matching_regression_signal(db: Session, *, deployment: Deployment) -> tuple[float, list[str]]:
    window_end = deployment.deployed_at + timedelta(hours=2)
    statement = (
        select(RegressionSnapshot)
        .where(
            RegressionSnapshot.project_id == deployment.project_id,
            RegressionSnapshot.detected_at >= deployment.deployed_at,
            RegressionSnapshot.detected_at <= window_end,
        )
        .order_by(desc(RegressionSnapshot.detected_at), RegressionSnapshot.metric_name)
    )
    if deployment.prompt_version is not None:
        statement = statement.where(
            (RegressionSnapshot.scope_type == "project")
            | (
                (RegressionSnapshot.scope_type == "prompt_version")
                & (RegressionSnapshot.scope_id == deployment.prompt_version.version)
            )
        )
    rows = db.scalars(statement).all()
    if not rows:
        return 0.0, []
    metric_names = [row.metric_name for row in rows]
    unique_metrics = sorted(set(metric_names))
    return _clamp(len(unique_metrics) / 3.0), unique_metrics


def _latest_quality_metric(
    db: Session,
    *,
    deployment: Deployment,
    metric_name: str,
) -> float | None:
    scope_type = "project"
    scope_id = str(deployment.project_id)
    if metric_name == "structured_output_validity_rate" and deployment.prompt_version_id is not None:
        scope_type = "prompt_version"
        scope_id = str(deployment.prompt_version_id)
    if metric_name == "quality_pass_rate" and deployment.model_version_id is not None:
        scope_type = "model_version"
        scope_id = str(deployment.model_version_id)
    row = db.scalar(
        select(EvaluationRollup)
        .where(
            EvaluationRollup.project_id == deployment.project_id,
            EvaluationRollup.scope_type == scope_type,
            EvaluationRollup.scope_id == scope_id,
            EvaluationRollup.metric_name
            == (
                "structured_output_validity_pass_rate"
                if metric_name == "structured_output_validity_rate"
                else "success_rate"
            ),
        )
        .order_by(desc(EvaluationRollup.window_end), desc(EvaluationRollup.created_at))
    )
    return float(row.metric_value) if row is not None else None


def _signal_summary(name: str, value: float, baseline: TraceWindowStats, current: TraceWindowStats) -> str:
    if name == "structured_output_delta":
        return (
            f"structured validity {baseline.structured_validity_rate:.2f} -> "
            f"{current.structured_validity_rate:.2f}, evaluation failures {current.evaluation_failure_rate:.2f}"
        )
    if name == "latency_delta":
        return f"p95 latency {baseline.p95_latency_ms:.0f}ms -> {current.p95_latency_ms:.0f}ms"
    if name == "error_rate_delta":
        return f"error rate {baseline.error_rate:.2f} -> {current.error_rate:.2f}"
    if name == "pattern_risk":
        return f"cross-project failure patterns contributed {value:.2f} risk"
    return f"nearby regressions matched deployment scope ({value:.2f})"


def _recommendations(signals: list[dict[str, Any]], deployment: Deployment) -> list[dict[str, str]]:
    ordered = sorted(signals, key=lambda item: item["weighted_value"], reverse=True)
    recommendations: list[dict[str, str]] = []
    for signal in ordered:
        if signal["weighted_value"] <= 0:
            continue
        name = signal["signal_name"]
        if name == "structured_output_delta":
            recommendations.append(
                {
                    "action": "review_prompt_output_contract",
                    "summary": "Check the deployed prompt and structured output contract before expanding rollout.",
                }
            )
        elif name == "latency_delta":
            recommendations.append(
                {
                    "action": "review_latency_budget",
                    "summary": "Compare retrieval latency and provider latency against the previous deployment window.",
                }
            )
        elif name == "error_rate_delta":
            recommendations.append(
                {
                    "action": "review_recent_failures",
                    "summary": "Inspect recent failing traces tied to this deployment before promoting it further.",
                }
            )
        elif name == "regression_signal":
            recommendations.append(
                {
                    "action": "check_related_regressions",
                    "summary": "Inspect linked regression snapshots and incident history around the deployment time.",
                }
            )
        if len(recommendations) == 2:
            break
    if not recommendations:
        recommendations.append(
            {
                "action": "continue_monitoring",
                "summary": f"Deployment on {deployment.environment} has limited negative evidence in the current analysis window.",
            }
        )
    return recommendations


def _risk_level(score: float) -> str:
    if score >= 0.65:
        return RISK_LEVEL_HIGH
    if score >= 0.35:
        return RISK_LEVEL_MEDIUM
    return RISK_LEVEL_LOW


def calculate_deployment_risk(db: Session, *, deployment_id: UUID) -> DeploymentRiskScore:
    deployment = db.scalar(
        select(Deployment)
        .options(
            selectinload(Deployment.project),
            selectinload(Deployment.prompt_version),
            selectinload(Deployment.model_version),
            selectinload(Deployment.incidents),
        )
        .where(Deployment.id == deployment_id)
    )
    if deployment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")

    current_start = _as_utc(deployment.deployed_at)
    baseline_start = current_start - timedelta(minutes=WINDOW_MINUTES)
    current_end = current_start + timedelta(minutes=WINDOW_MINUTES)

    baseline_traces = _trace_window_query(
        db,
        deployment=deployment,
        window_start=baseline_start,
        window_end=current_start,
    )
    current_traces = _trace_window_query(
        db,
        deployment=deployment,
        window_start=current_start,
        window_end=current_end,
    )
    baseline_stats = _window_stats(baseline_traces)
    current_stats = _window_stats(current_traces)
    regression_signal, regression_metrics = _matching_regression_signal(db, deployment=deployment)
    pattern_risk = get_pattern_risk(
        db,
        model_family=deployment.model_version.model_family if deployment.model_version is not None else None,
        prompt_pattern_hash=build_prompt_pattern_hash(
            str(deployment.prompt_version_id) if deployment.prompt_version_id is not None else None
        ),
    )
    graph_risk = get_model_failure_graph(
        db,
        model_family=deployment.model_version.model_family if deployment.model_version is not None else None,
        organization_ids=[deployment.project.organization_id] if deployment.project is not None else None,
        project_id=deployment.project_id,
    )
    global_pattern_risk = check_global_patterns(
        db,
        model_family=deployment.model_version.model_family if deployment.model_version is not None else None,
    )
    graph_explanations = [
        f"{item['pattern']} detected"
        for item in graph_risk["patterns"][:3]
    ]
    graph_explanations.extend(
        item["description"]
        for item in global_pattern_risk["patterns"][:2]
        if item.get("description")
    )

    structured_output_delta = _clamp(
        max(
            baseline_stats.structured_validity_rate - current_stats.structured_validity_rate,
            current_stats.evaluation_failure_rate,
        )
    )
    latency_delta = _clamp(
        (
            (current_stats.p95_latency_ms - baseline_stats.p95_latency_ms)
            / max(baseline_stats.p95_latency_ms, 1.0)
        )
        if current_stats.p95_latency_ms > 0
        else 0.0
    )
    error_rate_delta = _clamp(current_stats.error_rate - baseline_stats.error_rate)

    signals: list[dict[str, Any]] = []
    for signal_name, value in (
        ("structured_output_delta", structured_output_delta),
        ("latency_delta", latency_delta),
        ("error_rate_delta", error_rate_delta),
        ("regression_signal", regression_signal),
    ):
        weight = SIGNAL_WEIGHTS[signal_name]
        signals.append(
            {
                "signal_name": signal_name,
                "value": round(value, 4),
                "weight": weight,
                "weighted_value": round(value * weight, 4),
                "summary": _signal_summary(signal_name, value, baseline_stats, current_stats),
            }
        )

    risk_score = round(
        sum(item["weighted_value"] for item in signals)
        + float(pattern_risk["value"])
        + float(graph_risk["risk_score"]),
        4,
    )
    risk_score = round(
        risk_score + float(global_pattern_risk["risk_score"]),
        4,
    )
    analysis_json = {
        "window_minutes": WINDOW_MINUTES,
        "baseline_window_start": baseline_start.isoformat(),
        "baseline_window_end": current_start.isoformat(),
        "current_window_start": current_start.isoformat(),
        "current_window_end": current_end.isoformat(),
        "baseline_trace_count": baseline_stats.trace_count,
        "current_trace_count": current_stats.trace_count,
        "baseline_error_rate": round(baseline_stats.error_rate, 4),
        "current_error_rate": round(current_stats.error_rate, 4),
        "baseline_structured_validity_rate": round(baseline_stats.structured_validity_rate, 4),
        "current_structured_validity_rate": round(current_stats.structured_validity_rate, 4),
        "current_evaluation_failure_rate": round(current_stats.evaluation_failure_rate, 4),
        "baseline_p95_latency_ms": round(baseline_stats.p95_latency_ms, 2),
        "current_p95_latency_ms": round(current_stats.p95_latency_ms, 2),
        "matched_regression_metrics": regression_metrics,
        "pattern_risk": pattern_risk,
        "graph_risk": graph_risk,
        "global_pattern_risk": global_pattern_risk,
        "deployment_risk_explanations": graph_explanations,
        "latest_success_rate": _latest_quality_metric(
            db, deployment=deployment, metric_name="quality_pass_rate"
        ),
        "latest_structured_output_validity_rate": _latest_quality_metric(
            db, deployment=deployment, metric_name="structured_output_validity_rate"
        ),
        "signals": signals,
        "recommendations": _recommendations(signals, deployment),
    }

    record = db.scalar(
        select(DeploymentRiskScore).where(DeploymentRiskScore.deployment_id == deployment.id)
    )
    if record is None:
        record = DeploymentRiskScore(deployment_id=deployment.id, created_at=datetime.now(timezone.utc))
    record.risk_score = risk_score
    record.risk_level = _risk_level(risk_score)
    record.analysis_json = analysis_json
    record.created_at = datetime.now(timezone.utc)
    db.add(record)
    db.flush()
    return record


def get_deployment_risk_score(db: Session, *, deployment_id: UUID) -> DeploymentRiskScore | None:
    return db.scalar(
        select(DeploymentRiskScore).where(DeploymentRiskScore.deployment_id == deployment_id)
    )
