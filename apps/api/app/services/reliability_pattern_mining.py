from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reliability_pattern import ReliabilityPattern
from app.services.trace_query_router import query_all_traces_via_router
from app.services.trace_warehouse import MAX_EVENT_WINDOW, TraceWarehouseEventRow

PATTERN_LOOKBACK_DAYS = 7
LATENCY_SPIKE_THRESHOLD_MS = 1500
RETRIEVAL_LATENCY_THRESHOLD_MS = 1200
RETRIEVAL_CHUNK_MINIMUM = 1

PATTERN_TYPE_MODEL = "model_failure"
PATTERN_TYPE_PROMPT = "prompt_failure"
PATTERN_TYPE_RETRIEVAL = "retrieval_failure"

FAILURE_REQUEST = "request_failure"
FAILURE_STRUCTURED_OUTPUT = "structured_output_invalid"
FAILURE_LATENCY = "latency_spike"
FAILURE_HALLUCINATION = "hallucination_risk"


@dataclass(frozen=True)
class MinedPattern:
    pattern_type: str
    model_family: str | None
    prompt_pattern_hash: str | None
    failure_type: str
    failure_probability: float
    sample_count: int
    first_seen_at: datetime
    last_seen_at: datetime


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _prompt_bucket(input_tokens: int | None) -> str:
    if input_tokens is None:
        return "unknown"
    if input_tokens >= 500:
        return "large"
    if input_tokens >= 150:
        return "medium"
    return "small"


def build_prompt_pattern_hash(prompt_version_id: str | None, input_tokens: int | None = None) -> str | None:
    if prompt_version_id is None:
        return None
    raw = f"{prompt_version_id}|{_prompt_bucket(input_tokens)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _pattern(
    *,
    pattern_type: str,
    model_family: str | None,
    prompt_pattern_hash: str | None,
    failure_type: str,
    failed_count: int,
    rows: list[TraceWarehouseEventRow],
) -> MinedPattern | None:
    sample_count = len(rows)
    if sample_count <= 0 or failed_count <= 0:
        return None
    timestamps = [_as_utc(row.timestamp) for row in rows]
    return MinedPattern(
        pattern_type=pattern_type,
        model_family=model_family,
        prompt_pattern_hash=prompt_pattern_hash,
        failure_type=failure_type,
        failure_probability=round(failed_count / sample_count, 4),
        sample_count=sample_count,
        first_seen_at=min(timestamps),
        last_seen_at=max(timestamps),
    )


def _append_pattern(items: list[MinedPattern], pattern: MinedPattern | None) -> None:
    if pattern is not None:
        items.append(pattern)


def mine_model_failure_patterns(rows: list[TraceWarehouseEventRow]) -> list[MinedPattern]:
    grouped: dict[str, list[TraceWarehouseEventRow]] = {}
    for row in rows:
        key = row.model_family or "unknown"
        grouped.setdefault(key, []).append(row)

    patterns: list[MinedPattern] = []
    for model_family, group_rows in grouped.items():
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_MODEL,
                model_family=model_family,
                prompt_pattern_hash=None,
                failure_type=FAILURE_REQUEST,
                failed_count=sum(1 for row in group_rows if not row.success),
                rows=group_rows,
            ),
        )
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_MODEL,
                model_family=model_family,
                prompt_pattern_hash=None,
                failure_type=FAILURE_STRUCTURED_OUTPUT,
                failed_count=sum(1 for row in group_rows if row.structured_output_valid is False),
                rows=group_rows,
            ),
        )
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_MODEL,
                model_family=model_family,
                prompt_pattern_hash=None,
                failure_type=FAILURE_LATENCY,
                failed_count=sum(
                    1 for row in group_rows if row.latency_ms is not None and row.latency_ms >= LATENCY_SPIKE_THRESHOLD_MS
                ),
                rows=group_rows,
            ),
        )
    return patterns


def mine_prompt_failure_patterns(rows: list[TraceWarehouseEventRow]) -> list[MinedPattern]:
    grouped: dict[tuple[str | None, str], list[TraceWarehouseEventRow]] = {}
    for row in rows:
        prompt_pattern_hash = build_prompt_pattern_hash(row.prompt_version_id, row.input_tokens)
        if prompt_pattern_hash is None:
            continue
        key = (row.model_family or "unknown", prompt_pattern_hash)
        grouped.setdefault(key, []).append(row)

    patterns: list[MinedPattern] = []
    for (model_family, prompt_pattern_hash), group_rows in grouped.items():
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_PROMPT,
                model_family=model_family,
                prompt_pattern_hash=prompt_pattern_hash,
                failure_type=FAILURE_REQUEST,
                failed_count=sum(1 for row in group_rows if not row.success),
                rows=group_rows,
            ),
        )
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_PROMPT,
                model_family=model_family,
                prompt_pattern_hash=prompt_pattern_hash,
                failure_type=FAILURE_STRUCTURED_OUTPUT,
                failed_count=sum(1 for row in group_rows if row.structured_output_valid is False),
                rows=group_rows,
            ),
        )
    return patterns


def mine_retrieval_failure_patterns(rows: list[TraceWarehouseEventRow]) -> list[MinedPattern]:
    grouped: dict[tuple[str | None, str | None], list[TraceWarehouseEventRow]] = {}
    for row in rows:
        grouped.setdefault(
            (
                row.model_family or "unknown",
                build_prompt_pattern_hash(row.prompt_version_id, row.input_tokens),
            ),
            [],
        ).append(row)

    patterns: list[MinedPattern] = []
    for (model_family, prompt_pattern_hash), group_rows in grouped.items():
        retrieval_rows = [
            row
            for row in group_rows
            if row.retrieval_chunks is not None or row.retrieval_latency_ms is not None
        ]
        if not retrieval_rows:
            continue
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_RETRIEVAL,
                model_family=model_family,
                prompt_pattern_hash=prompt_pattern_hash,
                failure_type=FAILURE_HALLUCINATION,
                failed_count=sum(
                    1
                    for row in retrieval_rows
                    if (row.retrieval_chunks is not None and row.retrieval_chunks <= RETRIEVAL_CHUNK_MINIMUM)
                    and (not row.success or row.structured_output_valid is False)
                ),
                rows=retrieval_rows,
            ),
        )
        _append_pattern(
            patterns,
            _pattern(
                pattern_type=PATTERN_TYPE_RETRIEVAL,
                model_family=model_family,
                prompt_pattern_hash=prompt_pattern_hash,
                failure_type=FAILURE_LATENCY,
                failed_count=sum(
                    1
                    for row in retrieval_rows
                    if row.retrieval_latency_ms is not None
                    and row.retrieval_latency_ms >= RETRIEVAL_LATENCY_THRESHOLD_MS
                ),
                rows=retrieval_rows,
            ),
        )
    return patterns


def upsert_patterns(db: Session, patterns: Iterable[MinedPattern]) -> list[ReliabilityPattern]:
    existing = {
        (
            item.pattern_type,
            item.model_family,
            item.prompt_pattern_hash,
            item.failure_type,
        ): item
        for item in db.scalars(select(ReliabilityPattern)).all()
    }

    persisted: list[ReliabilityPattern] = []
    for item in patterns:
        key = (item.pattern_type, item.model_family, item.prompt_pattern_hash, item.failure_type)
        record = existing.get(key)
        if record is None:
            record = ReliabilityPattern(
                pattern_type=item.pattern_type,
                model_family=item.model_family,
                prompt_pattern_hash=item.prompt_pattern_hash,
                failure_type=item.failure_type,
                failure_probability=item.failure_probability,
                sample_count=item.sample_count,
                first_seen_at=item.first_seen_at,
                last_seen_at=item.last_seen_at,
            )
        else:
            record.failure_probability = item.failure_probability
            record.sample_count = item.sample_count
            record.first_seen_at = min(_as_utc(record.first_seen_at), item.first_seen_at)
            record.last_seen_at = max(_as_utc(record.last_seen_at), item.last_seen_at)
        db.add(record)
        persisted.append(record)
    db.flush()
    return persisted


def mine_patterns_last_7_days(db: Session, *, anchor_time: datetime | None = None) -> list[ReliabilityPattern]:
    end = anchor_time or _utc_now()
    start = end - timedelta(days=PATTERN_LOOKBACK_DAYS)
    rows: list[TraceWarehouseEventRow] = []
    cursor = start
    while cursor < end:
        window_end = min(cursor + MAX_EVENT_WINDOW, end)
        _, batch = query_all_traces_via_router(window_start=cursor, window_end=window_end)
        rows.extend(batch)
        cursor = window_end
    patterns = [
        *mine_model_failure_patterns(rows),
        *mine_prompt_failure_patterns(rows),
        *mine_retrieval_failure_patterns(rows),
    ]
    return upsert_patterns(db, patterns)


def update_probability_scores(db: Session, *, anchor_time: datetime | None = None) -> list[ReliabilityPattern]:
    return mine_patterns_last_7_days(db, anchor_time=anchor_time)


def list_reliability_patterns(db: Session) -> list[ReliabilityPattern]:
    return db.scalars(
        select(ReliabilityPattern).order_by(
            ReliabilityPattern.failure_probability.desc(),
            ReliabilityPattern.sample_count.desc(),
            ReliabilityPattern.last_seen_at.desc(),
            ReliabilityPattern.pattern_type.asc(),
            ReliabilityPattern.failure_type.asc(),
            ReliabilityPattern.id.asc(),
        )
    ).all()


def get_reliability_pattern(db: Session, *, pattern_id) -> ReliabilityPattern | None:
    return db.get(ReliabilityPattern, pattern_id)


def get_pattern_risk(
    db: Session,
    *,
    model_family: str | None,
    prompt_pattern_hash: str | None,
) -> dict[str, object]:
    matched = [
        item
        for item in list_reliability_patterns(db)
        if (
            (model_family is not None and item.model_family == model_family)
            or (prompt_pattern_hash is not None and item.prompt_pattern_hash == prompt_pattern_hash)
        )
    ]
    weights = {
        FAILURE_REQUEST: 1.0,
        FAILURE_STRUCTURED_OUTPUT: 1.0,
        FAILURE_LATENCY: 0.8,
        FAILURE_HALLUCINATION: 0.7,
    }
    value = min(
        0.3,
        sum(float(item.failure_probability) * weights.get(item.failure_type, 0.5) * 0.2 for item in matched),
    )
    return {
        "value": round(value, 4),
        "matched_patterns": [
            {
                "pattern_id": str(item.id),
                "pattern_type": item.pattern_type,
                "failure_type": item.failure_type,
                "failure_probability": round(float(item.failure_probability), 4),
                "sample_count": item.sample_count,
            }
            for item in matched[:6]
        ],
    }
