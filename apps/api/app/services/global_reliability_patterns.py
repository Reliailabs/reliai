from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.models.global_reliability_pattern import GlobalReliabilityPattern
from app.models.reliability_pattern import ReliabilityPattern
from app.services.reliability_pattern_mining import (
    FAILURE_HALLUCINATION,
    FAILURE_LATENCY,
    FAILURE_REQUEST,
    FAILURE_STRUCTURED_OUTPUT,
)
from app.services.trace_query_router import query_all_traces_via_router
from app.services.trace_warehouse import MAX_EVENT_WINDOW, TraceWarehouseEventRow

GLOBAL_PATTERN_LOOKBACK_DAYS = 30
GLOBAL_PATTERN_LIMIT = 25


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _pattern_key(pattern_type: str, model_family: str | None, failure_type: str) -> str:
    raw = f"{pattern_type}|{model_family or 'unknown'}|{failure_type}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _recommended_guardrails(pattern_type: str, failure_type: str) -> list[str]:
    if failure_type == FAILURE_STRUCTURED_OUTPUT:
        return ["structured_output", "latency_retry"]
    if failure_type == FAILURE_LATENCY:
        return ["latency_retry"]
    if failure_type == FAILURE_HALLUCINATION:
        return ["hallucination", "structured_output"]
    if pattern_type == "retrieval_failure":
        return ["hallucination", "latency_retry"]
    return ["structured_output"]


def _description(pattern_type: str, model_family: str | None, failure_type: str) -> str:
    model_label = model_family or "unknown model"
    if failure_type == FAILURE_LATENCY:
        return f"{model_label} shows repeated latency spike patterns"
    if failure_type == FAILURE_STRUCTURED_OUTPUT:
        return f"{model_label} shows structured output instability"
    if failure_type == FAILURE_HALLUCINATION:
        return f"{model_label} shows retrieval-linked hallucination risk"
    return f"{model_label} shows elevated request failure patterns"


def _impact_text(occurrence_count: int, organizations_affected: int, average_probability: float) -> str:
    return (
        f"{occurrence_count} matching failures across {organizations_affected} organizations "
        f"with {average_probability:.0%} average failure probability"
    )


def _row_matches_pattern(row: TraceWarehouseEventRow, *, model_family: str | None, failure_type: str) -> bool:
    if model_family is not None and row.model_family != model_family:
        return False
    if failure_type == FAILURE_REQUEST:
        return not row.success
    if failure_type == FAILURE_STRUCTURED_OUTPUT:
        return row.structured_output_valid is False
    if failure_type == FAILURE_LATENCY:
        return (row.latency_ms or 0) >= 1500 or (row.retrieval_latency_ms or 0) >= 1200
    if failure_type == FAILURE_HALLUCINATION:
        return (
            row.retrieval_chunks is not None
            and row.retrieval_chunks <= 1
            and (not row.success or row.structured_output_valid is False)
        )
    return False


def _warehouse_impacts(
    rows: list[TraceWarehouseEventRow],
    *,
    model_family: str | None,
    failure_type: str,
) -> tuple[int, int, dict[str, Any]]:
    matched = [row for row in rows if _row_matches_pattern(row, model_family=model_family, failure_type=failure_type)]
    organizations_affected = len({row.organization_id for row in matched})
    latencies = [float(row.latency_ms) for row in matched if row.latency_ms is not None]
    costs = [float(row.cost_usd) for row in matched if row.cost_usd is not None]
    impact = {
        "average_latency_ms": round(mean(latencies), 2) if latencies else None,
        "average_cost_usd": round(mean(costs), 6) if costs else None,
        "failure_type": failure_type,
    }
    return len(matched), organizations_affected, impact


def _load_global_trace_rows(*, anchor: datetime) -> list[TraceWarehouseEventRow]:
    rows: list[TraceWarehouseEventRow] = []
    start = anchor - timedelta(days=GLOBAL_PATTERN_LOOKBACK_DAYS)
    cursor = start
    while cursor < anchor:
        window_end = min(cursor + MAX_EVENT_WINDOW, anchor)
        _, batch = query_all_traces_via_router(window_start=cursor, window_end=window_end)
        rows.extend(batch)
        cursor = window_end
    return rows


def run_global_pattern_mining_for_session(db: Session, *, anchor_time: str | None = None) -> list[GlobalReliabilityPattern]:
    anchor = datetime.fromisoformat(anchor_time) if anchor_time is not None else _utcnow()
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    else:
        anchor = anchor.astimezone(timezone.utc)

    warehouse_rows = _load_global_trace_rows(anchor=anchor)
    db.execute(delete(GlobalReliabilityPattern))

    grouped: dict[tuple[str, str | None, str], list[ReliabilityPattern]] = defaultdict(list)
    for item in db.scalars(select(ReliabilityPattern)).all():
        grouped[(item.pattern_type, item.model_family, item.failure_type)].append(item)

    persisted: list[GlobalReliabilityPattern] = []
    for (pattern_type, model_family, failure_type), items in grouped.items():
        occurrence_count, organizations_affected, impact = _warehouse_impacts(
            warehouse_rows,
            model_family=model_family,
            failure_type=failure_type,
        )
        if occurrence_count <= 0 or organizations_affected <= 0:
            continue
        average_probability = sum(item.failure_probability for item in items) / len(items)
        confidence_score = round(
            min(
                0.99,
                (average_probability * 0.7)
                + (min(organizations_affected / 10.0, 1.0) * 0.2)
                + (min(occurrence_count / 500.0, 1.0) * 0.1),
            ),
            4,
        )
        pattern_id = _pattern_key(pattern_type, model_family, failure_type)
        record = GlobalReliabilityPattern(
            pattern_id=pattern_id,
            pattern_type=pattern_type,
            conditions_json={
                "model_family": model_family,
                "failure_type": failure_type,
            },
            impact_metrics_json={
                **impact,
                "average_failure_probability": round(average_probability, 4),
                "description": _description(pattern_type, model_family, failure_type),
                "impact": _impact_text(occurrence_count, organizations_affected, average_probability),
                "recommended_guardrails": _recommended_guardrails(pattern_type, failure_type),
            },
            occurrence_count=occurrence_count,
            organizations_affected=organizations_affected,
            confidence_score=confidence_score,
            created_at=anchor,
        )
        db.add(record)
        persisted.append(record)

    db.flush()
    return persisted


def get_global_reliability_patterns(db: Session, *, limit: int = GLOBAL_PATTERN_LIMIT) -> list[dict]:
    items = db.scalars(
        select(GlobalReliabilityPattern)
        .order_by(
            desc(GlobalReliabilityPattern.confidence_score),
            desc(GlobalReliabilityPattern.organizations_affected),
            desc(GlobalReliabilityPattern.occurrence_count),
        )
        .limit(limit)
    ).all()
    payload: list[dict] = []
    for item in items:
        description = str(item.impact_metrics_json.get("description") or "Global reliability pattern")
        recommended_guardrails = [str(value) for value in item.impact_metrics_json.get("recommended_guardrails", [])]
        model_family = item.conditions_json.get("model_family")
        failure_type = str(item.conditions_json.get("failure_type") or "unknown_failure")
        risk_level = "high" if item.confidence_score >= 0.65 else "medium" if item.confidence_score >= 0.35 else "low"
        payload.append(
            {
                "pattern_id": item.pattern_id,
                "pattern_type": item.pattern_type,
                "description": description,
                "impact": str(item.impact_metrics_json.get("impact") or ""),
                "recommended_guardrails": recommended_guardrails,
                "impact_metrics_json": item.impact_metrics_json,
                "model_family": str(model_family or "unknown"),
                "issue": failure_type.replace("_", " "),
                "risk_level": risk_level,
                "organizations_affected": item.organizations_affected,
                "trace_count": item.occurrence_count,
                "first_seen": item.created_at,
                "recommended_guardrail": recommended_guardrails[0] if recommended_guardrails else "structured_output",
                "confidence": round(float(item.confidence_score), 4),
                "pattern": description,
            }
        )
    return payload


def check_global_patterns(
    db: Session,
    *,
    model_family: str | None,
    limit: int = 3,
) -> dict[str, Any]:
    if not model_family:
        return {"risk_score": 0.0, "patterns": []}
    rows = [
        row
        for row in db.scalars(
            select(GlobalReliabilityPattern).order_by(
                desc(GlobalReliabilityPattern.confidence_score),
                desc(GlobalReliabilityPattern.occurrence_count),
            )
        ).all()
        if row.conditions_json.get("model_family") == model_family
    ][:limit]
    patterns = [
        {
            "pattern_id": row.pattern_id,
            "description": str(row.impact_metrics_json.get("description") or "Global reliability pattern"),
            "impact": str(row.impact_metrics_json.get("impact") or ""),
            "recommended_guardrails": [
                str(value) for value in row.impact_metrics_json.get("recommended_guardrails", [])
            ],
            "confidence": round(float(row.confidence_score), 4),
            "organizations_affected": int(row.organizations_affected),
            "occurrence_count": int(row.occurrence_count),
        }
        for row in rows
    ]
    risk_score = round(min(0.15, sum(float(row.confidence_score) * 0.08 for row in rows)), 4)
    return {"risk_score": risk_score, "patterns": patterns}


def find_similar_platform_failures(
    db: Session,
    *,
    model_family: str | None,
    limit: int = 3,
) -> list[dict]:
    result = check_global_patterns(db, model_family=model_family, limit=limit)
    return result["patterns"]
