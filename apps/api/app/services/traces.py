import base64
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.project import Project
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.schemas.trace import TraceIngestRequest, TraceListQuery
from app.services.auth import OperatorContext
from app.services.authorization import require_trace_access
from app.services.event_stream import TraceIngestedEventPayload, publish_event
from app.services.guardrails import evaluate_trace_guardrails
from app.services.incidents import _structured_output_label
from app.services.onboarding import mark_trace_ingested
from app.services.reliability_graph import sync_trace_retrieval_span
from app.services.registry import link_trace_registry_records
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window
from app.core.settings import get_settings

logger = logging.getLogger(__name__)
PREVIEW_LENGTH = 240


@dataclass
class TraceListResult:
    items: list[Trace]
    next_cursor: str | None


@dataclass(frozen=True)
class TraceCompareResult:
    trace: Trace
    baseline_trace: Trace | None
    current_window_start: datetime
    current_window_end: datetime
    baseline_window_start: datetime
    baseline_window_end: datetime


def _build_preview(value: str | None) -> str | None:
    if value is None:
        return None
    compact = " ".join(value.split())
    return compact[:PREVIEW_LENGTH] if compact else None


def _encode_cursor(created_at: datetime, trace_id: UUID) -> str:
    payload = {"created_at": created_at.isoformat(), "id": str(trace_id)}
    return base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8"))
        return datetime.fromisoformat(payload["created_at"]), UUID(payload["id"])
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor") from exc


def publish_trace_ingested_event(trace: Trace) -> None:
    try:
        settings = get_settings()
        timestamp = trace.timestamp
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        payload = TraceIngestedEventPayload(
            trace_id=str(trace.id),
            project_id=str(trace.project_id),
            timestamp=timestamp,
            prompt_version_id=(
                str(trace.prompt_version_record_id) if trace.prompt_version_record_id is not None else None
            ),
            model_version_id=(
                str(trace.model_version_record_id) if trace.model_version_record_id is not None else None
            ),
            latency_ms=trace.latency_ms,
            success=trace.success,
            metadata=trace.metadata_json or {},
        ).model_dump(mode="json")
        payload["timestamp"] = timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        publish_event(settings.event_stream_topic_traces, payload)
    except Exception:
        logger.exception("failed to publish trace ingest event", extra={"trace_id": str(trace.id)})


def create_trace(db: Session, project: Project, payload: TraceIngestRequest) -> Trace:
    try:
        is_explainable = bool(
            payload.model_name
            and payload.prompt_version
            and payload.latency_ms is not None
            and payload.prompt_tokens is not None
            and payload.completion_tokens is not None
        )
        trace = Trace(
            organization_id=project.organization_id,
            project_id=project.id,
            environment=project.environment,
            timestamp=payload.timestamp,
            request_id=payload.request_id,
            user_id=payload.user_id,
            session_id=payload.session_id,
            model_name=payload.model_name,
            model_provider=payload.model_provider,
            prompt_version=payload.prompt_version,
            input_text=payload.input_text,
            output_text=payload.output_text,
            input_preview=_build_preview(payload.input_text),
            output_preview=_build_preview(payload.output_text),
            latency_ms=payload.latency_ms,
            prompt_tokens=payload.prompt_tokens,
            completion_tokens=payload.completion_tokens,
            total_cost_usd=payload.total_cost_usd,
            is_explainable=is_explainable,
            success=payload.success,
            error_type=payload.error_type,
            metadata_json=payload.metadata_json,
        )
        db.add(trace)
        db.flush()

        retrieval_span = None
        if payload.retrieval is not None:
            retrieval_span = RetrievalSpan(
                trace_id=trace.id,
                retrieval_latency_ms=payload.retrieval.retrieval_latency_ms,
                source_count=payload.retrieval.source_count,
                top_k=payload.retrieval.top_k,
                query_text=payload.retrieval.query_text,
                retrieved_chunks_json=payload.retrieval.retrieved_chunks_json,
            )
            db.add(retrieval_span)
            db.flush()
            sync_trace_retrieval_span(
                db,
                trace_id=trace.id,
                retrieval_provider=(payload.metadata_json or {}).get("retrieval_provider")
                if payload.metadata_json is not None
                else None,
                retrieval_span=retrieval_span,
            )

        link_trace_registry_records(db, trace=trace, project=project)
        evaluate_trace_guardrails(db, project=project, trace=trace)
        project.last_trace_received_at = trace.created_at
        db.add(project)

        mark_trace_ingested(db, project.organization_id)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(trace)
    return trace


def ingest_trace(db: Session, api_key, payload: TraceIngestRequest) -> Trace:
    project = db.get(Project, api_key.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    trace = create_trace(db, project, payload)
    publish_trace_ingested_event(trace)
    return trace


def list_traces(db: Session, operator: OperatorContext, filters: TraceListQuery) -> TraceListResult:
    statement = (
        select(Trace)
        .where(Trace.organization_id.in_(operator.organization_ids))
        .order_by(desc(Trace.created_at), desc(Trace.id))
    )

    if filters.project_id is not None:
        statement = statement.where(Trace.project_id == filters.project_id)
    if filters.model_name is not None:
        statement = statement.where(Trace.model_name == filters.model_name)
    if filters.prompt_version is not None:
        statement = statement.where(Trace.prompt_version == filters.prompt_version)
    if getattr(filters, "prompt_version_id", None) is not None:
        statement = statement.where(Trace.prompt_version_record_id == filters.prompt_version_id)
    if getattr(filters, "model_version_id", None) is not None:
        statement = statement.where(Trace.model_version_record_id == filters.model_version_id)
    if filters.success is not None:
        statement = statement.where(Trace.success == filters.success)
    if filters.date_from is not None:
        statement = statement.where(Trace.timestamp >= filters.date_from)
    if filters.date_to is not None:
        statement = statement.where(Trace.timestamp <= filters.date_to)

    if filters.cursor is not None:
        cursor_created_at, cursor_id = _decode_cursor(filters.cursor)
        statement = statement.where(
            or_(
                Trace.created_at < cursor_created_at,
                and_(Trace.created_at == cursor_created_at, Trace.id < cursor_id),
            )
        )

    rows = db.scalars(statement.limit(filters.limit + 1)).all()
    next_cursor = None
    items = rows[: filters.limit]
    if len(rows) > filters.limit:
        last = items[-1]
        next_cursor = _encode_cursor(last.created_at, last.id)
    return TraceListResult(items=items, next_cursor=next_cursor)


def get_trace_detail(db: Session, operator: OperatorContext, trace_id: UUID) -> Trace:
    statement = (
        select(Trace)
        .options(
            selectinload(Trace.retrieval_span),
            selectinload(Trace.evaluations),
            selectinload(Trace.prompt_version_record),
            selectinload(Trace.model_version_record),
        )
        .where(Trace.id == trace_id, Trace.organization_id.in_(operator.organization_ids))
    )
    trace = db.scalar(statement)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    trace.evaluations.sort(key=lambda item: (item.eval_type, item.created_at))
    return trace


def _numeric_distance(left: int | Decimal | None, right: int | Decimal | None) -> float:
    if left is None or right is None:
        return float("inf")
    return abs(float(left) - float(right))


def _trace_baseline_sort_key(trace: Trace, candidate: Trace):
    structured_pass = _structured_output_label(candidate) == "pass"
    record_prompt_match = (
        trace.prompt_version_record_id is not None
        and candidate.prompt_version_record_id == trace.prompt_version_record_id
    )
    record_model_match = (
        trace.model_version_record_id is not None
        and candidate.model_version_record_id == trace.model_version_record_id
    )
    string_prompt_match = trace.prompt_version is not None and candidate.prompt_version == trace.prompt_version
    model_name_match = candidate.model_name == trace.model_name
    return (
        1 if record_prompt_match else 0,
        1 if record_model_match else 0,
        1 if candidate.success else 0,
        1 if structured_pass else 0,
        1 if string_prompt_match else 0,
        1 if model_name_match else 0,
        -_numeric_distance(candidate.latency_ms, trace.latency_ms),
        -(
            _numeric_distance(candidate.prompt_tokens, trace.prompt_tokens)
            + _numeric_distance(candidate.completion_tokens, trace.completion_tokens)
        ),
        candidate.timestamp,
        str(candidate.id),
    )


def _rank_trace_baseline_candidates(trace: Trace, candidates: list[Trace]) -> list[Trace]:
    return sorted(
        candidates,
        key=lambda candidate: _trace_baseline_sort_key(trace, candidate),
        reverse=True,
    )


def get_trace_compare(db: Session, operator: OperatorContext, trace_id: UUID) -> TraceCompareResult:
    require_trace_access(db, operator, trace_id)
    trace = get_trace_detail(db, operator, trace_id)
    baseline_window_end = trace.timestamp
    current_window_start = trace.timestamp
    current_window_end = trace.timestamp

    search_windows = [
        timedelta(hours=24),
        timedelta(days=7),
    ]
    ranked: list[Trace] = []
    baseline_window_start = baseline_window_end - search_windows[-1]

    for window in search_windows:
        baseline_window_start = baseline_window_end - window
        candidates = [
            candidate
            for candidate in query_trace_window(
                db,
                TraceWindowQuery(
                    organization_id=trace.organization_id,
                    project_id=trace.project_id,
                    window_start=baseline_window_start,
                    window_end=baseline_window_end,
                    prompt_version=trace.prompt_version if trace.prompt_version_record_id is None else None,
                    prompt_version_record_id=trace.prompt_version_record_id,
                    model_version_record_id=trace.model_version_record_id,
                    with_details=True,
                    limit=100,
                ),
            )
            if candidate.id != trace.id
            and (
                candidate.model_version_record_id == trace.model_version_record_id
                if trace.model_version_record_id is not None
                else candidate.model_name == trace.model_name
            )
            and (
                trace.model_provider is None
                or getattr(candidate, "model_provider", None) == trace.model_provider
                or trace.model_version_record_id is not None
            )
            and candidate.timestamp < trace.timestamp
        ]
        ranked = _rank_trace_baseline_candidates(trace, candidates)
        if ranked:
            break

    if not ranked:
        baseline_window_start = baseline_window_end - timedelta(days=7)
        fallback_candidates = [
            candidate
            for candidate in query_trace_window(
                db,
                TraceWindowQuery(
                    organization_id=trace.organization_id,
                    project_id=trace.project_id,
                    window_start=baseline_window_start,
                    window_end=baseline_window_end,
                    with_details=True,
                    limit=100,
                ),
            )
            if candidate.id != trace.id
            and candidate.timestamp < trace.timestamp
            and candidate.success
            and (
                (
                    trace.prompt_version_record_id is not None
                    and trace.model_version_record_id is not None
                    and candidate.prompt_version_record_id == trace.prompt_version_record_id
                    and candidate.model_version_record_id == trace.model_version_record_id
                )
                or (
                    candidate.prompt_version == trace.prompt_version
                    and candidate.model_name == trace.model_name
                )
            )
        ]
        ranked = _rank_trace_baseline_candidates(trace, fallback_candidates)

    baseline_trace = ranked[0] if ranked else None
    return TraceCompareResult(
        trace=trace,
        baseline_trace=baseline_trace,
        current_window_start=current_window_start,
        current_window_end=current_window_end,
        baseline_window_start=baseline_window_start,
        baseline_window_end=baseline_window_end,
    )
