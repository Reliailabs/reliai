from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment_simulation import DeploymentSimulation
from app.models.model_version import ModelVersion
from app.models.project import Project
from app.models.prompt_version import PromptVersion
from app.services.environments import resolve_project_environment
from app.services.reliability_intelligence import get_network_risk_adjustment
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window

SIMULATION_LOOKBACK_DAYS = 30
RECENT_LOOKBACK_DAYS = 7
SIMULATION_STATUS_QUEUED = "queued"
SIMULATION_STATUS_COMPLETED = "completed"
STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"


@dataclass(frozen=True)
class SimulationSampleResult:
    traces: list[object]
    strategy: str
    recent_count: int
    historical_count: int


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _validate_registry_scope(
    db: Session,
    *,
    project_id: UUID,
    prompt_version_id: UUID | None,
    model_version_id: UUID | None,
) -> tuple[PromptVersion | None, ModelVersion | None]:
    prompt_version = None
    model_version = None
    if prompt_version_id is not None:
        prompt_version = db.get(PromptVersion, prompt_version_id)
        if prompt_version is None or prompt_version.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt version does not belong to project",
            )
    if model_version_id is not None:
        model_version = db.get(ModelVersion, model_version_id)
        if model_version is None or model_version.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Model version does not belong to project",
            )
    return prompt_version, model_version


def _simulation_query(
    *,
    organization_id: UUID,
    project_id: UUID,
    environment_id: UUID,
    window_start: datetime,
    window_end: datetime,
    prompt_version: PromptVersion | None,
    model_version: ModelVersion | None,
    limit: int,
):
    return TraceWindowQuery(
        organization_id=organization_id,
        project_id=project_id,
        environment_id=environment_id,
        window_start=window_start,
        window_end=window_end,
        prompt_version=prompt_version.version if prompt_version is not None else None,
        prompt_version_record_id=prompt_version.id if prompt_version is not None else None,
        model_version_record_id=model_version.id if model_version is not None else None,
        with_details=True,
        limit=limit,
    )


def _trace_key(trace: object) -> str:
    return str(getattr(trace, "id"))


def _trace_timestamp(trace: object) -> datetime:
    return _as_utc(getattr(trace, "timestamp"))


def _bounded_deduped(traces: list[object], *, limit: int) -> list[object]:
    seen: set[str] = set()
    ordered = sorted(traces, key=lambda item: (_trace_timestamp(item), _trace_key(item)), reverse=True)
    unique: list[object] = []
    for trace in ordered:
        key = _trace_key(trace)
        if key in seen:
            continue
        seen.add(key)
        unique.append(trace)
        if len(unique) >= limit:
            break
    return unique


def _sample_historical_traces(
    db: Session,
    *,
    organization_id: UUID,
    project_id: UUID,
    environment_id: UUID,
    prompt_version: PromptVersion | None,
    model_version: ModelVersion | None,
    sample_size: int,
) -> SimulationSampleResult:
    now = _utcnow()
    recent_start = now - timedelta(days=RECENT_LOOKBACK_DAYS)
    full_start = now - timedelta(days=SIMULATION_LOOKBACK_DAYS)

    recent_traces = query_trace_window(
        db,
        _simulation_query(
            organization_id=organization_id,
            project_id=project_id,
            environment_id=environment_id,
            window_start=recent_start,
            window_end=now,
            prompt_version=prompt_version,
            model_version=model_version,
            limit=sample_size,
        ),
    )
    if len(recent_traces) >= sample_size:
        return SimulationSampleResult(
            traces=_bounded_deduped(recent_traces, limit=sample_size),
            strategy="recent_exact",
            recent_count=len(recent_traces),
            historical_count=0,
        )

    historical_traces = query_trace_window(
        db,
        _simulation_query(
            organization_id=organization_id,
            project_id=project_id,
            environment_id=environment_id,
            window_start=full_start,
            window_end=recent_start,
            prompt_version=prompt_version,
            model_version=model_version,
            limit=sample_size,
        ),
    )

    combined = _bounded_deduped([*recent_traces, *historical_traces], limit=sample_size)
    strategy = "recent_plus_historical_exact"
    if not combined:
        fallback_recent = query_trace_window(
            db,
            TraceWindowQuery(
                organization_id=organization_id,
                project_id=project_id,
                environment_id=environment_id,
                window_start=recent_start,
                window_end=now,
                prompt_version=prompt_version.version if prompt_version is not None else None,
                with_details=True,
                limit=sample_size,
            ),
        )
        fallback_historical = query_trace_window(
            db,
            TraceWindowQuery(
                organization_id=organization_id,
                project_id=project_id,
                environment_id=environment_id,
                window_start=full_start,
                window_end=recent_start,
                prompt_version=prompt_version.version if prompt_version is not None else None,
                with_details=True,
                limit=sample_size,
            ),
        )
        combined = _bounded_deduped([*fallback_recent, *fallback_historical], limit=sample_size)
        strategy = "fallback_prompt_string"
    if not combined and model_version is not None:
        fallback_recent = query_trace_window(
            db,
            TraceWindowQuery(
                organization_id=organization_id,
                project_id=project_id,
                environment_id=environment_id,
                window_start=recent_start,
                window_end=now,
                model_version_record_id=model_version.id,
                with_details=True,
                limit=sample_size,
            ),
        )
        fallback_historical = query_trace_window(
            db,
            TraceWindowQuery(
                organization_id=organization_id,
                project_id=project_id,
                environment_id=environment_id,
                window_start=full_start,
                window_end=recent_start,
                model_version_record_id=model_version.id,
                with_details=True,
                limit=sample_size,
            ),
        )
        combined = _bounded_deduped([*fallback_recent, *fallback_historical], limit=sample_size)
        strategy = "fallback_model_registry"
    if not combined and model_version is not None:
        fallback_recent = query_trace_window(
            db,
            TraceWindowQuery(
                organization_id=organization_id,
                project_id=project_id,
                environment_id=environment_id,
                window_start=recent_start,
                window_end=now,
                model_name=model_version.model_name,  # type: ignore[arg-type]
                with_details=True,
                limit=sample_size,
            ),
        )
        fallback_historical = query_trace_window(
            db,
            TraceWindowQuery(
                organization_id=organization_id,
                project_id=project_id,
                environment_id=environment_id,
                window_start=full_start,
                window_end=recent_start,
                model_name=model_version.model_name,  # type: ignore[arg-type]
                with_details=True,
                limit=sample_size,
            ),
        )
        combined = _bounded_deduped([*fallback_recent, *fallback_historical], limit=sample_size)
        strategy = "fallback_model_name"
    return SimulationSampleResult(
        traces=combined,
        strategy=strategy,
        recent_count=len(recent_traces),
        historical_count=len(historical_traces),
    )


def _structured_output_valid(trace: object) -> bool | None:
    for evaluation in getattr(trace, "evaluations", []):
        eval_type = getattr(evaluation, "eval_type", getattr(evaluation, "evaluation_type", None))
        if eval_type != STRUCTURED_VALIDITY_EVAL_TYPE:
            continue
        label = getattr(evaluation, "label", None)
        metadata_json = getattr(evaluation, "metadata_json", None) or {}
        if label == "pass" or metadata_json.get("label") == "pass":
            return True
        if label == "fail" or metadata_json.get("label") == "fail":
            return False
    return None


def _evaluation_failure(trace: object) -> bool:
    for evaluation in getattr(trace, "evaluations", []):
        label = getattr(evaluation, "label", None)
        metadata_json = getattr(evaluation, "metadata_json", None) or {}
        if label == "fail" or metadata_json.get("label") == "fail":
            return True
    return False


def _risk_level(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


def _analysis_for_traces(
    db: Session,
    *,
    traces: list[object],
    strategy: str,
    sample_size: int,
    prompt_version: PromptVersion | None,
    model_version: ModelVersion | None,
    recent_count: int,
    historical_count: int,
) -> tuple[float | None, float | None, str | None, dict]:
    if not traces:
        return (
            None,
            None,
            None,
            {
                "status": SIMULATION_STATUS_COMPLETED,
                "sample_strategy": strategy,
                "requested_sample_size": sample_size,
                "actual_sample_size": 0,
                "recent_sample_count": recent_count,
                "historical_sample_count": historical_count,
                "signals": [],
                "prompt_version_id": str(prompt_version.id) if prompt_version is not None else None,
                "model_version_id": str(model_version.id) if model_version is not None else None,
                "recommendations": [],
            },
        )

    failure_rate = sum(1 for trace in traces if not getattr(trace, "success", False)) / len(traces)
    latencies = [getattr(trace, "latency_ms", None) for trace in traces if getattr(trace, "latency_ms", None) is not None]
    predicted_latency_ms = mean(latencies) if latencies else None
    structured = [_structured_output_valid(trace) for trace in traces]
    structured_known = [value for value in structured if value is not None]
    structured_invalid_rate = (
        sum(1 for value in structured_known if value is False) / len(structured_known)
        if structured_known
        else 0.0
    )
    evaluation_failure_rate = sum(1 for trace in traces if _evaluation_failure(trace)) / len(traces)
    latency_signal = min(1.0, (predicted_latency_ms or 0.0) / 2000.0)
    base_score = min(
        1.0,
        (structured_invalid_rate * 0.4)
        + (failure_rate * 0.3)
        + (latency_signal * 0.2)
        + (evaluation_failure_rate * 0.1),
    )
    network_risk = get_network_risk_adjustment(
        db,
        prompt_version=prompt_version.version if prompt_version is not None else None,
        model_provider=model_version.provider if model_version is not None else None,
        model_name=(
            model_version.model_family
            if model_version is not None and model_version.model_family is not None
            else model_version.model_name if model_version is not None else None
        ),
    )
    score = min(1.0, base_score + float(network_risk["value"]))
    risk_level = _risk_level(score)
    signals = [
        {
            "signal_name": "structured_output_invalid_rate",
            "value": round(structured_invalid_rate, 4),
        },
        {
            "signal_name": "predicted_failure_rate",
            "value": round(failure_rate, 4),
        },
        {
            "signal_name": "predicted_latency_ms",
            "value": round(predicted_latency_ms, 2) if predicted_latency_ms is not None else None,
        },
        {
            "signal_name": "evaluation_failure_rate",
            "value": round(evaluation_failure_rate, 4),
        },
    ]
    recommendations: list[dict[str, str]] = []
    if structured_invalid_rate >= 0.2:
        recommendations.append(
            {"action": "review_prompt_output_contract", "summary": "Structured output failures are elevated in the sampled traces."}
        )
    if failure_rate >= 0.2:
        recommendations.append(
            {"action": "run_shadow_validation", "summary": "Predicted failure rate is elevated for the proposed deployment scope."}
        )
    if predicted_latency_ms is not None and predicted_latency_ms >= 1000:
        recommendations.append(
            {"action": "canary_rollout", "summary": "Predicted latency is high enough to justify a smaller rollout step."}
        )
    analysis = {
        "status": SIMULATION_STATUS_COMPLETED,
        "sample_strategy": strategy,
        "requested_sample_size": sample_size,
        "actual_sample_size": len(traces),
        "recent_sample_count": recent_count,
        "historical_sample_count": historical_count,
        "prompt_version_id": str(prompt_version.id) if prompt_version is not None else None,
        "model_version_id": str(model_version.id) if model_version is not None else None,
        "prompt_version": prompt_version.version if prompt_version is not None else None,
        "model_name": model_version.model_name if model_version is not None else None,
        "signals": signals,
        "score_components": {
            "structured_output_invalid_rate": round(structured_invalid_rate * 0.4, 4),
            "failure_rate": round(failure_rate * 0.3, 4),
            "latency_signal": round(latency_signal * 0.2, 4),
            "evaluation_failure_rate": round(evaluation_failure_rate * 0.1, 4),
            "network_risk_adjustment": round(float(network_risk["value"]), 4),
        },
        "network_risk_adjustment": network_risk,
        "sample_trace_ids": [str(getattr(trace, "id")) for trace in traces[:25]],
        "recommendations": recommendations,
        "risk_score": round(score, 4),
        "base_risk_score": round(base_score, 4),
    }
    return round(failure_rate, 4), round(predicted_latency_ms, 2) if predicted_latency_ms is not None else None, risk_level, analysis


def create_deployment_simulation(
    db: Session,
    *,
    organization_id: UUID,
    project_id: UUID,
    environment_name: str | None,
    prompt_version_id: UUID | None,
    model_version_id: UUID | None,
    sample_size: int,
) -> DeploymentSimulation:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    prompt_version, model_version = _validate_registry_scope(
        db,
        project_id=project_id,
        prompt_version_id=prompt_version_id,
        model_version_id=model_version_id,
    )
    environment = resolve_project_environment(db, project=project, name=environment_name)
    simulation = DeploymentSimulation(
        project_id=project_id,
        environment_id=environment.id,
        prompt_version_id=prompt_version.id if prompt_version is not None else None,
        model_version_id=model_version.id if model_version is not None else None,
        trace_sample_size=sample_size,
        predicted_failure_rate=None,
        predicted_latency_ms=None,
        risk_level=None,
        analysis_json={
            "status": SIMULATION_STATUS_QUEUED,
            "requested_sample_size": sample_size,
            "environment": environment.name,
            "prompt_version_id": str(prompt_version.id) if prompt_version is not None else None,
            "model_version_id": str(model_version.id) if model_version is not None else None,
        },
        created_at=_utcnow(),
    )
    db.add(simulation)
    db.commit()
    db.refresh(simulation)
    return simulation


def get_deployment_simulation(db: Session, *, simulation_id: UUID) -> DeploymentSimulation | None:
    return db.scalar(
        select(DeploymentSimulation)
        .options(
            selectinload(DeploymentSimulation.prompt_version),
            selectinload(DeploymentSimulation.model_version),
        )
        .where(DeploymentSimulation.id == simulation_id)
    )


def simulate_deployment(db: Session, *, simulation_id: UUID) -> DeploymentSimulation | None:
    simulation = get_deployment_simulation(db, simulation_id=simulation_id)
    if simulation is None:
        return None
    project = db.get(Project, simulation.project_id)
    if project is None:
        return None
    prompt_version = simulation.prompt_version
    model_version = simulation.model_version
    sample = _sample_historical_traces(
        db,
        organization_id=project.organization_id,
        project_id=simulation.project_id,
        environment_id=simulation.environment_id,
        prompt_version=prompt_version,
        model_version=model_version,
        sample_size=simulation.trace_sample_size,
    )
    failure_rate, predicted_latency_ms, risk_level, analysis = _analysis_for_traces(
        db,
        traces=sample.traces,
        strategy=sample.strategy,
        sample_size=simulation.trace_sample_size,
        prompt_version=prompt_version,
        model_version=model_version,
        recent_count=sample.recent_count,
        historical_count=sample.historical_count,
    )
    simulation.predicted_failure_rate = failure_rate
    simulation.predicted_latency_ms = predicted_latency_ms
    simulation.risk_level = risk_level
    simulation.analysis_json = analysis
    db.add(simulation)
    db.flush()
    return simulation
