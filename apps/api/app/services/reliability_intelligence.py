from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.models.guardrail_effectiveness import GuardrailEffectiveness
from app.models.guardrail_event import GuardrailEvent
from app.models.guardrail_policy import GuardrailPolicy
from app.models.model_reliability_pattern import ModelReliabilityPattern
from app.models.prompt_failure_pattern import PromptFailurePattern
from app.models.trace import Trace
from app.services.reliability_pattern_mining import build_prompt_pattern_hash, get_pattern_risk
from app.services.trace_warehouse import TraceWarehouseEventRow, query_all_traces

INTELLIGENCE_LOOKBACK_DAYS = 30


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, round((len(ordered) - 1) * percentile))
    return round(float(ordered[index]), 4)


def prompt_pattern_hash_from_row(row: TraceWarehouseEventRow) -> str:
    metadata = row.metadata_json or {}
    prompt_version = str(metadata.get("__prompt_version") or "unknown")
    expected_format = str(metadata.get("expected_output_format") or "unknown")
    bucket = "small"
    if row.input_tokens is not None and row.input_tokens >= 500:
        bucket = "large"
    elif row.input_tokens is not None and row.input_tokens >= 150:
        bucket = "medium"
    raw = f"{prompt_version}|{expected_format}|{bucket}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def prompt_pattern_hash_for_prompt_version(prompt_version: str) -> str:
    return hashlib.sha256(f"{prompt_version}|unknown|small".encode("utf-8")).hexdigest()[:24]


def _provider_name(row: TraceWarehouseEventRow) -> str:
    metadata = row.metadata_json or {}
    return str(metadata.get("__model_provider") or "unknown")


def _model_name(row: TraceWarehouseEventRow) -> str:
    metadata = row.metadata_json or {}
    return str(metadata.get("__model_name") or "unknown")


def _cost_distribution(rows: list[TraceWarehouseEventRow]) -> dict[str, Any]:
    costs = [float(row.cost) for row in rows if row.cost is not None]
    if not costs:
        return {"average": None, "p50": None, "p95": None}
    return {
        "average": round(mean(costs), 6),
        "p50": _percentile(costs, 0.50),
        "p95": _percentile(costs, 0.95),
    }


def _latency_percentiles(rows: list[TraceWarehouseEventRow]) -> dict[str, Any]:
    latencies = [float(row.latency_ms) for row in rows if row.latency_ms is not None]
    if not latencies:
        return {"p50": None, "p95": None, "p99": None}
    return {
        "p50": _percentile(latencies, 0.50),
        "p95": _percentile(latencies, 0.95),
        "p99": _percentile(latencies, 0.99),
    }


def _failure_modes(rows: list[TraceWarehouseEventRow]) -> dict[str, Any]:
    failed = [row for row in rows if not row.success]
    counts = Counter((row.error_type or "unknown_error") for row in failed)
    total = sum(counts.values())
    return {
        key: {
            "count": value,
            "rate": round(value / total, 4) if total else 0.0,
        }
        for key, value in counts.most_common(5)
    }


def aggregate_reliability_intelligence(db: Session, *, computed_at: datetime | None = None) -> None:
    anchor = computed_at or _utcnow()
    window_start = anchor - timedelta(days=INTELLIGENCE_LOOKBACK_DAYS)
    rows = query_all_traces(window_start=window_start, window_end=anchor)

    db.execute(delete(ModelReliabilityPattern))
    db.execute(delete(PromptFailurePattern))
    db.execute(delete(GuardrailEffectiveness))

    model_groups: dict[tuple[str, str], list[TraceWarehouseEventRow]] = defaultdict(list)
    prompt_groups: dict[str, list[TraceWarehouseEventRow]] = defaultdict(list)
    for row in rows:
        model_groups[(_provider_name(row), _model_name(row))].append(row)
        prompt_groups[prompt_pattern_hash_from_row(row)].append(row)

    for (provider, model_name), group_rows in model_groups.items():
        structured_known = [row.structured_output_valid for row in group_rows if row.structured_output_valid is not None]
        invalid_rate = (
            sum(1 for value in structured_known if value is False) / len(structured_known)
            if structured_known
            else 0.0
        )
        db.add(
            ModelReliabilityPattern(
                provider=provider,
                model_name=model_name,
                failure_modes=_failure_modes(group_rows),
                structured_output_failure_rate=round(invalid_rate, 4),
                latency_percentiles=_latency_percentiles(group_rows),
                cost_distribution=_cost_distribution(group_rows),
                updated_at=anchor,
            )
        )

    for prompt_hash, group_rows in prompt_groups.items():
        failed = sum(1 for row in group_rows if not row.success)
        models = Counter(_model_name(row) for row in group_rows)
        db.add(
            PromptFailurePattern(
                prompt_pattern_hash=prompt_hash,
                failure_rate=round(failed / len(group_rows), 4) if group_rows else 0.0,
                token_range={
                    "input_min": min((row.input_tokens for row in group_rows if row.input_tokens is not None), default=None),
                    "input_max": max((row.input_tokens for row in group_rows if row.input_tokens is not None), default=None),
                    "output_min": min((row.output_tokens for row in group_rows if row.output_tokens is not None), default=None),
                    "output_max": max((row.output_tokens for row in group_rows if row.output_tokens is not None), default=None),
                },
                model_distribution={
                    model: round(count / len(group_rows), 4) for model, count in models.most_common(5)
                },
                updated_at=anchor,
            )
        )

    effectiveness_rows = db.execute(
        select(GuardrailPolicy.policy_type, GuardrailEvent.action_taken, Trace.success)
        .join(GuardrailEvent, GuardrailEvent.policy_id == GuardrailPolicy.id)
        .join(Trace, Trace.id == GuardrailEvent.trace_id)
    ).all()
    grouped_effectiveness: dict[tuple[str, str], list[bool]] = defaultdict(list)
    for policy_type, action_taken, success in effectiveness_rows:
        grouped_effectiveness[(policy_type, action_taken)].append(bool(success))
    for (policy_type, action_taken), successes in grouped_effectiveness.items():
        success_rate = sum(1 for value in successes if value) / len(successes)
        db.add(
            GuardrailEffectiveness(
                policy_type=policy_type,
                action=action_taken,
                failure_reduction_rate=round(success_rate, 4),
                updated_at=anchor,
            )
        )

    db.flush()


def get_model_insights(db: Session) -> list[ModelReliabilityPattern]:
    return db.scalars(
        select(ModelReliabilityPattern).order_by(
            desc(ModelReliabilityPattern.structured_output_failure_rate),
            ModelReliabilityPattern.provider,
            ModelReliabilityPattern.model_name,
        )
    ).all()


def get_prompt_risk_scores(db: Session) -> list[PromptFailurePattern]:
    return db.scalars(
        select(PromptFailurePattern).order_by(
            desc(PromptFailurePattern.failure_rate),
            PromptFailurePattern.prompt_pattern_hash,
        )
    ).all()


def get_prompt_risk_score(db: Session) -> list[PromptFailurePattern]:
    return get_prompt_risk_scores(db)


def get_guardrail_recommendations(db: Session) -> list[GuardrailEffectiveness]:
    return db.scalars(
        select(GuardrailEffectiveness).order_by(
            desc(GuardrailEffectiveness.failure_reduction_rate),
            GuardrailEffectiveness.policy_type,
            GuardrailEffectiveness.action,
        )
    ).all()


def get_network_risk_adjustment(
    db: Session,
    *,
    prompt_version: str | None,
    model_provider: str | None,
    model_name: str | None,
) -> dict[str, Any]:
    model_pattern = None
    if model_provider is not None and model_name is not None:
        model_pattern = db.get(ModelReliabilityPattern, {"provider": model_provider, "model_name": model_name})

    prompt_pattern = None
    prompt_hash = None
    if prompt_version is not None:
        prompt_hash = prompt_pattern_hash_for_prompt_version(prompt_version)
        prompt_pattern = db.get(PromptFailurePattern, prompt_hash)

    adjustment = 0.0
    model_signal = 0.0
    prompt_signal = 0.0
    if model_pattern is not None:
        latency_p95 = model_pattern.latency_percentiles.get("p95")
        model_signal = min(
            0.18,
            (model_pattern.structured_output_failure_rate * 0.12)
            + (min(float(latency_p95 or 0.0) / 4000.0, 1.0) * 0.06),
        )
        adjustment += model_signal
    if prompt_pattern is not None:
        prompt_signal = min(0.12, prompt_pattern.failure_rate * 0.12)
        adjustment += prompt_signal

    reliability_pattern_risk = get_pattern_risk(
        db,
        model_family=model_name,
        prompt_pattern_hash=build_prompt_pattern_hash(prompt_version),
    )
    adjustment += float(reliability_pattern_risk["value"])

    return {
        "value": round(min(0.25, adjustment), 4),
        "model_pattern": {
            "provider": model_pattern.provider,
            "model_name": model_pattern.model_name,
            "structured_output_failure_rate": model_pattern.structured_output_failure_rate,
            "latency_percentiles": model_pattern.latency_percentiles,
        }
        if model_pattern is not None
        else None,
        "prompt_pattern_hash": prompt_hash,
        "prompt_failure_rate": prompt_pattern.failure_rate if prompt_pattern is not None else None,
        "components": {
            "model_signal": round(model_signal, 4),
            "prompt_signal": round(prompt_signal, 4),
            "reliability_pattern_signal": round(float(reliability_pattern_risk["value"]), 4),
        },
        "reliability_pattern_risk": reliability_pattern_risk,
    }
