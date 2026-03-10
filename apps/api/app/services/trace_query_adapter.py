from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid5, NAMESPACE_URL

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.model_version import ModelVersion
from app.models.prompt_version import PromptVersion
from app.models.trace import Trace
from app.services.trace_warehouse import TraceWarehouseEventRow, TraceWarehouseQuery, query_traces

TRACE_WAREHOUSE_RECENT_WINDOW = timedelta(days=7)
STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _maybe_uuid(value: str | UUID | None) -> UUID | None:
    if value is None or isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except ValueError:
        return None


@dataclass(frozen=True)
class TraceWindowQuery:
    organization_id: UUID
    project_id: UUID
    window_start: datetime
    window_end: datetime
    environment_id: UUID | None = None
    prompt_version: str | None = None
    prompt_version_record_id: UUID | None = None
    model_version_record_id: UUID | None = None
    model_name: str | None = None
    latency_min_ms: int | None = None
    latency_max_ms: int | None = None
    success: bool | None = None
    structured_output_valid: bool | None = None
    with_details: bool = False
    limit: int | None = None


def _warehouse_backed(query: TraceWindowQuery, *, now: datetime | None = None) -> bool:
    anchor = _ensure_utc(now or datetime.now(timezone.utc))
    recent_cutoff = anchor - TRACE_WAREHOUSE_RECENT_WINDOW
    return _ensure_utc(query.window_end) < recent_cutoff


def trace_window_backend(query: TraceWindowQuery, *, now: datetime | None = None) -> str:
    return "warehouse" if _warehouse_backed(query, now=now) else "postgres"


def _postgres_trace_window(db: Session, query: TraceWindowQuery) -> list[Trace]:
    statement = select(Trace).where(
        Trace.organization_id == query.organization_id,
        Trace.project_id == query.project_id,
        Trace.timestamp >= query.window_start,
        Trace.timestamp < query.window_end,
    )
    if query.environment_id is not None:
        statement = statement.where(Trace.environment_id == query.environment_id)
    if query.with_details or query.structured_output_valid is not None:
        statement = statement.options(
            selectinload(Trace.retrieval_span),
            selectinload(Trace.evaluations),
            selectinload(Trace.prompt_version_record),
            selectinload(Trace.model_version_record),
        )
    if query.prompt_version is not None:
        statement = statement.where(Trace.prompt_version == query.prompt_version)
    if query.prompt_version_record_id is not None:
        statement = statement.where(Trace.prompt_version_record_id == query.prompt_version_record_id)
    if query.model_version_record_id is not None:
        statement = statement.where(Trace.model_version_record_id == query.model_version_record_id)
    if query.model_name is not None:
        statement = statement.where(Trace.model_name == query.model_name)
    if query.success is not None:
        statement = statement.where(Trace.success == query.success)
    if query.latency_min_ms is not None:
        statement = statement.where(Trace.latency_ms.is_not(None), Trace.latency_ms >= query.latency_min_ms)
    if query.latency_max_ms is not None:
        statement = statement.where(Trace.latency_ms.is_not(None), Trace.latency_ms <= query.latency_max_ms)
    statement = statement.order_by(desc(Trace.timestamp), desc(Trace.id))
    traces = db.scalars(statement).unique().all()
    if query.structured_output_valid is not None:
        filtered: list[Trace] = []
        for trace in traces:
            structured = None
            for evaluation in getattr(trace, "evaluations", []):
                if evaluation.eval_type != STRUCTURED_VALIDITY_EVAL_TYPE:
                    continue
                if evaluation.label == "pass":
                    structured = True
                    break
                if evaluation.label == "fail":
                    structured = False
                    break
            if structured == query.structured_output_valid:
                filtered.append(trace)
        traces = filtered
    if query.limit is not None:
        traces = traces[: query.limit]
    return traces


def _structured_evaluations(trace_id: UUID, timestamp: datetime, structured_output_valid: bool | None):
    if structured_output_valid is None:
        return [], []
    label = "pass" if structured_output_valid else "fail"
    score = Decimal("100.00") if structured_output_valid else Decimal("0.00")
    evaluation = SimpleNamespace(
        eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
        label=label,
        score=score,
        raw_result_json={"status": label, "source": "trace_warehouse"},
    )
    graph_evaluation = SimpleNamespace(
        id=uuid5(NAMESPACE_URL, f"{trace_id}:structured_validity"),
        trace_id=trace_id,
        evaluation_type=STRUCTURED_VALIDITY_EVAL_TYPE,
        score=score,
        metadata_json={"label": label, "source": "trace_warehouse"},
        created_at=timestamp,
    )
    return [evaluation], [graph_evaluation]


def _warehouse_trace_view(
    row: TraceWarehouseEventRow,
    *,
    prompt_version_record: PromptVersion | None,
    model_version_record: ModelVersion | None,
):
    metadata = row.metadata_json or {}
    evaluations, graph_evaluations = _structured_evaluations(
        row.trace_id,
        row.timestamp,
        row.structured_output_valid,
    )
    retrieval_span = None
    graph_retrieval_span = None
    if row.retrieval_latency_ms is not None or row.retrieval_chunks is not None:
        retrieval_span = SimpleNamespace(
            retrieval_latency_ms=row.retrieval_latency_ms,
            source_count=row.retrieval_chunks,
            top_k=None,
            query_text=None,
            retrieved_chunks_json=None,
        )
        graph_retrieval_span = SimpleNamespace(
            id=uuid5(NAMESPACE_URL, f"{row.trace_id}:retrieval"),
            trace_id=row.trace_id,
            retrieval_provider=metadata.get("retrieval_provider"),
            latency_ms=row.retrieval_latency_ms,
            chunk_count=row.retrieval_chunks,
            metadata_json=None,
            created_at=row.timestamp,
        )
    return SimpleNamespace(
        id=row.trace_id,
        organization_id=row.organization_id,
        project_id=row.project_id,
        environment_id=row.environment_id,
        environment=metadata.get("environment", "warehouse"),
        timestamp=row.timestamp,
        created_at=row.timestamp,
        request_id=metadata.get("request_id", str(row.trace_id)),
        user_id=None,
        session_id=None,
        model_name=(model_version_record.model_name if model_version_record is not None else metadata.get("__model_name")) or "unknown",
        model_provider=(model_version_record.provider if model_version_record is not None else metadata.get("__model_provider")),
        prompt_version=(prompt_version_record.version if prompt_version_record is not None else metadata.get("__prompt_version")),
        input_text=None,
        output_text=None,
        input_preview=None,
        output_preview=None,
        latency_ms=row.latency_ms,
        prompt_tokens=row.input_tokens,
        completion_tokens=row.output_tokens,
        total_cost_usd=row.cost,
        success=row.success,
        error_type=row.error_type,
        metadata_json=metadata,
        prompt_version_record_id=_maybe_uuid(row.prompt_version_id),
        model_version_record_id=row.model_version_id,
        prompt_version_record=prompt_version_record,
        model_version_record=model_version_record,
        retrieval_span=retrieval_span,
        graph_retrieval_span=graph_retrieval_span,
        evaluations=evaluations,
        graph_evaluations=graph_evaluations,
    )


def _warehouse_trace_window(db: Session, query: TraceWindowQuery):
    rows = query_traces(
        TraceWarehouseQuery(
            organization_id=query.organization_id,
            project_id=query.project_id,
            environment_id=query.environment_id,
            window_start=query.window_start,
            window_end=query.window_end,
            prompt_version_id=query.prompt_version_record_id,
            model_version_id=query.model_version_record_id,
            prompt_version=query.prompt_version,
            model_name=query.model_name,
            latency_min_ms=query.latency_min_ms,
            latency_max_ms=query.latency_max_ms,
            success=query.success,
            structured_output_valid=query.structured_output_valid,
            limit=query.limit,
        )
    )
    prompt_ids = sorted(
        {_maybe_uuid(row.prompt_version_id) for row in rows if _maybe_uuid(row.prompt_version_id) is not None},
        key=str,
    )
    model_ids = sorted({row.model_version_id for row in rows if row.model_version_id is not None}, key=str)
    prompt_versions = {
        item.id: item
        for item in (
            db.scalars(select(PromptVersion).where(PromptVersion.id.in_(prompt_ids))).all()
            if prompt_ids
            else []
        )
    }
    model_versions = {
        item.id: item
        for item in (
            db.scalars(select(ModelVersion).where(ModelVersion.id.in_(model_ids))).all()
            if model_ids
            else []
        )
    }
    return [
        _warehouse_trace_view(
            row,
            prompt_version_record=prompt_versions.get(_maybe_uuid(row.prompt_version_id)),
            model_version_record=model_versions.get(row.model_version_id),
        )
        for row in rows
    ]


def query_trace_window(db: Session, query: TraceWindowQuery):
    if _warehouse_backed(query):
        warehouse_rows = _warehouse_trace_window(db, query)
        if warehouse_rows:
            return warehouse_rows
        # Keep investigation flows working while warehouse coverage is still partial.
        return _postgres_trace_window(db, query)
    return _postgres_trace_window(db, query)
