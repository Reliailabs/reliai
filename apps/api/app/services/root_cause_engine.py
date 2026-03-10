from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median
from typing import Any

from sqlalchemy.orm import Session

from app.models.deployment import Deployment
from app.models.incident import Incident
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.services.auth import OperatorContext
from app.services.deployment_risk_engine import calculate_deployment_risk
from app.services.incidents import (
    derive_dimension_summaries,
    derive_root_cause_hints,
    get_incident_compare_traces,
    get_incident_detail,
    get_incident_regressions,
)
from app.services.trace_query_adapter import TraceWindowQuery, trace_window_backend


@dataclass(frozen=True)
class RootCauseReport:
    incident: Incident
    regressions: list[RegressionSnapshot]
    current_traces: list[Trace]
    baseline_traces: list[Trace]
    root_cause_probabilities: list[dict[str, Any]]
    evidence: dict[str, Any]
    recommended_fix: dict[str, Any]
    generated_at: datetime


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _share(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return count / total


def _median(values: list[int]) -> float | None:
    if not values:
        return None
    return float(median(values))


def _normalize_probabilities(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    positive = [entry for entry in entries if entry["raw_score"] > 0]
    if not positive:
        return []
    total = sum(entry["raw_score"] for entry in positive)
    normalized: list[dict[str, Any]] = []
    for entry in positive:
        normalized.append(
            {
                "cause_type": entry["cause_type"],
                "label": entry["label"],
                "probability": round(entry["raw_score"] / total, 4),
                "evidence_json": entry["evidence_json"],
            }
        )
    return sorted(normalized, key=lambda item: (-item["probability"], item["cause_type"]))


def _deployment_match_score(
    deployment: Deployment | None,
    *,
    prompt_value: str | None = None,
    model_value: str | None = None,
) -> tuple[float, dict[str, Any] | None]:
    if deployment is None:
        return 0.0, None
    evidence: dict[str, Any] = {"deployment_id": str(deployment.id)}
    score = 0.0
    if prompt_value is not None and deployment.prompt_version is not None and deployment.prompt_version.version == prompt_value:
        score += 0.2
        evidence["deployment_prompt_version"] = deployment.prompt_version.version
    if model_value is not None and deployment.model_version is not None and deployment.model_version.model_name == model_value:
        score += 0.15
        evidence["deployment_model_name"] = deployment.model_version.model_name
    return score, evidence if score > 0 else None


def _prompt_concentration_entry(
    *,
    hints: list[dict[str, Any]],
    deployment: Deployment | None,
) -> dict[str, Any] | None:
    hint = next((item for item in hints if item["hint_type"] == "prompt_version_concentration"), None)
    if hint is None:
        return None
    current_share = float(hint.get("current_share") or 0)
    baseline_share = float(hint.get("baseline_share") or 0)
    deployment_bonus, deployment_evidence = _deployment_match_score(
        deployment,
        prompt_value=hint.get("current_value"),
    )
    return {
        "cause_type": "prompt_concentration",
        "label": f"Prompt change probability: {hint.get('current_value') or 'unknown'}",
        "raw_score": max(0.0, current_share - baseline_share) + deployment_bonus,
        "evidence_json": {
            "current_value": hint.get("current_value"),
            "baseline_value": hint.get("baseline_value"),
            "current_share": current_share,
            "baseline_share": baseline_share,
            "supporting_trace_ids": [str(item) for item in hint.get("supporting_trace_ids", [])],
            **(deployment_evidence or {}),
        },
    }


def _model_concentration_entry(
    *,
    hints: list[dict[str, Any]],
    deployment: Deployment | None,
) -> dict[str, Any] | None:
    hint = next((item for item in hints if item["hint_type"] == "model_concentration"), None)
    if hint is None:
        return None
    current_share = float(hint.get("current_share") or 0)
    baseline_share = float(hint.get("baseline_share") or 0)
    deployment_bonus, deployment_evidence = _deployment_match_score(
        deployment,
        model_value=hint.get("current_value"),
    )
    return {
        "cause_type": "model_concentration",
        "label": f"Model change probability: {hint.get('current_value') or 'unknown'}",
        "raw_score": max(0.0, current_share - baseline_share) + deployment_bonus,
        "evidence_json": {
            "current_value": hint.get("current_value"),
            "baseline_value": hint.get("baseline_value"),
            "current_share": current_share,
            "baseline_share": baseline_share,
            "supporting_trace_ids": [str(item) for item in hint.get("supporting_trace_ids", [])],
            **(deployment_evidence or {}),
        },
    }


def _latency_change_entry(*, current_traces: list[Trace], baseline_traces: list[Trace]) -> dict[str, Any] | None:
    current_latencies = [trace.latency_ms for trace in current_traces if trace.latency_ms is not None]
    baseline_latencies = [trace.latency_ms for trace in baseline_traces if trace.latency_ms is not None]
    current_median = _median(current_latencies)
    baseline_median = _median(baseline_latencies)
    if current_median is None or baseline_median is None or current_median <= baseline_median:
        return None
    delta_ratio = (current_median - baseline_median) / max(baseline_median, 1.0)
    if delta_ratio < 0.25:
        return None
    return {
        "cause_type": "latency_change",
        "label": "Latency shifted upward",
        "raw_score": min(0.35, delta_ratio),
        "evidence_json": {
            "current_median_latency_ms": current_median,
            "baseline_median_latency_ms": baseline_median,
            "delta_ratio": round(delta_ratio, 4),
        },
    }


def _retrieval_shift_entry(*, current_traces: list[Trace], baseline_traces: list[Trace]) -> dict[str, Any] | None:
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
    current_median = _median(current_retrieval)
    baseline_median = _median(baseline_retrieval)
    if current_median is None or baseline_median is None or current_median <= baseline_median:
        return None
    delta_ratio = (current_median - baseline_median) / max(baseline_median, 1.0)
    if delta_ratio < 0.20:
        return None
    return {
        "cause_type": "retrieval_shift",
        "label": "Retrieval latency spike",
        "raw_score": min(0.25, delta_ratio),
        "evidence_json": {
            "current_retrieval_median_ms": current_median,
            "baseline_retrieval_median_ms": baseline_median,
            "delta_ratio": round(delta_ratio, 4),
        },
    }


def _deployment_risk_correlation_entry(*, deployment: Deployment | None) -> dict[str, Any] | None:
    if deployment is None or deployment.risk_score is None:
        return None
    risk_level = deployment.risk_score.risk_level
    risk_score = float(deployment.risk_score.risk_score)
    if risk_level not in {"medium", "high"}:
        return None
    return {
        "cause_type": "deployment_risk_correlation",
        "label": "Deployment risk correlation",
        "raw_score": min(0.35, risk_score),
        "evidence_json": {
            "deployment_id": str(deployment.id),
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "signals": deployment.risk_score.analysis_json.get("signals", []),
        },
    }


def _error_cluster_entry(*, current_traces: list[Trace]) -> dict[str, Any] | None:
    failing = [trace for trace in current_traces if not trace.success]
    if len(failing) < 2:
        return None
    counts: dict[str, int] = {}
    trace_ids: dict[str, list[str]] = {}
    for trace in failing:
        key = trace.error_type or "failure"
        counts[key] = counts.get(key, 0) + 1
        trace_ids.setdefault(key, []).append(str(trace.id))
    dominant_error, dominant_count = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0]
    share = _share(dominant_count, len(failing))
    if share < 0.5:
        return None
    return {
        "cause_type": "error_cluster",
        "label": f"Error cluster: {dominant_error}",
        "raw_score": share,
        "evidence_json": {
            "error_type": dominant_error,
            "current_share": round(share, 4),
            "supporting_trace_ids": trace_ids[dominant_error][:5],
        },
    }


def _recommended_fix(top_probability: dict[str, Any]) -> dict[str, Any]:
    recommendations = {
        "prompt_concentration": (
            "prompt_review",
            "Review the latest prompt version change and compare failing traces against the prior prompt version.",
        ),
        "model_concentration": (
            "model_rollback_check",
            "Review the latest model rollout and verify whether reverting or narrowing the model route is safe.",
        ),
        "latency_change": (
            "latency_investigation",
            "Inspect latency regressions across recent traces and deployment changes before retry or timeout adjustments.",
        ),
        "retrieval_shift": (
            "retrieval_investigation",
            "Inspect retrieval latency and source availability changes before adjusting prompt or model behavior.",
        ),
        "deployment_risk_correlation": (
            "deployment_rollback_check",
            "Review the latest deployment risk signals and consider narrowing or rolling back the rollout before broader changes.",
        ),
        "error_cluster": (
            "error_type_investigation",
            "Inspect the dominant error cluster and the linked failing traces before rollout changes.",
        ),
    }
    fix_type, summary = recommendations.get(
        top_probability["cause_type"],
        ("investigate_supporting_traces", "Inspect the supporting traces and recent changes before taking action."),
    )
    return {
        "fix_type": fix_type,
        "summary": summary,
        "metadata_json": {"cause_type": top_probability["cause_type"]},
    }


def _window_backend(incident: Incident, *, start_key: str, end_key: str) -> str | None:
    summary = incident.summary_json or {}
    start_raw = summary.get(start_key)
    end_raw = summary.get(end_key)
    if start_raw is None or end_raw is None:
        return None
    return trace_window_backend(
        TraceWindowQuery(
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            environment_id=incident.environment_id,
            window_start=datetime.fromisoformat(start_raw),
            window_end=datetime.fromisoformat(end_raw),
            prompt_version=summary.get("scope_id") if summary.get("scope_type") == "prompt_version" else None,
        )
    )


def analyze_incident_root_cause(
    db: Session,
    *,
    incident: Incident,
    regressions: list[RegressionSnapshot],
    current_traces: list[Trace],
    baseline_traces: list[Trace],
) -> RootCauseReport:
    deployment = db.get(Deployment, incident.deployment_id) if incident.deployment_id is not None else None
    if deployment is not None:
        deployment.prompt_version
        deployment.model_version
        if deployment.risk_score is None:
            deployment.risk_score = calculate_deployment_risk(db, deployment_id=deployment.id)
    hints = derive_root_cause_hints(
        incident=incident,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )
    dimension_summaries = derive_dimension_summaries(
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )

    entries = [
        _prompt_concentration_entry(hints=hints, deployment=deployment),
        _model_concentration_entry(hints=hints, deployment=deployment),
        _latency_change_entry(current_traces=current_traces, baseline_traces=baseline_traces),
        _retrieval_shift_entry(current_traces=current_traces, baseline_traces=baseline_traces),
        _deployment_risk_correlation_entry(deployment=deployment),
        _error_cluster_entry(current_traces=current_traces),
    ]
    probabilities = _normalize_probabilities([entry for entry in entries if entry is not None])
    if not probabilities:
        probabilities = [
            {
                "cause_type": "insufficient_signal",
                "label": "Insufficient signal concentration",
                "probability": 1.0,
                "evidence_json": {"current_trace_count": len(current_traces), "baseline_trace_count": len(baseline_traces)},
            }
        ]

    top_probability = probabilities[0]
    evidence = {
        "regression_snapshot_ids": [str(regression.id) for regression in regressions],
        "current_trace_ids": [str(trace.id) for trace in current_traces],
        "baseline_trace_ids": [str(trace.id) for trace in baseline_traces],
        "deployment_id": str(incident.deployment_id) if incident.deployment_id is not None else None,
        "current_trace_backend": _window_backend(incident, start_key="current_window_start", end_key="current_window_end"),
        "baseline_trace_backend": _window_backend(
            incident,
            start_key="baseline_window_start",
            end_key="baseline_window_end",
        ),
        "dimension_summaries": dimension_summaries,
        "root_cause_hints": hints,
    }
    return RootCauseReport(
        incident=incident,
        regressions=regressions,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
        root_cause_probabilities=probabilities,
        evidence=evidence,
        recommended_fix=_recommended_fix(top_probability),
        generated_at=_now(),
    )


def get_incident_analysis(
    db: Session,
    operator: OperatorContext,
    *,
    incident_id,
) -> RootCauseReport:
    incident = get_incident_detail(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    current_traces, baseline_traces = get_incident_compare_traces(db, incident)
    return analyze_incident_root_cause(
        db,
        incident=incident,
        regressions=regressions,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )
