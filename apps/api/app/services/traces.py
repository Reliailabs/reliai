import base64
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_queue
from app.models.project import Project
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.schemas.trace import TraceIngestRequest, TraceListQuery
from app.services.auth import OperatorContext
from app.services.onboarding import mark_trace_ingested
from app.workers.evaluations import run_trace_evaluations

logger = logging.getLogger(__name__)
PREVIEW_LENGTH = 240


@dataclass
class TraceListResult:
    items: list[Trace]
    next_cursor: str | None


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


def enqueue_trace_evaluations(trace_id: UUID) -> None:
    try:
        get_queue().enqueue(run_trace_evaluations, str(trace_id))
    except Exception:
        logger.exception("failed to enqueue trace evaluations", extra={"trace_id": str(trace_id)})


def create_trace(db: Session, project: Project, payload: TraceIngestRequest) -> Trace:
    try:
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
            success=payload.success,
            error_type=payload.error_type,
            metadata_json=payload.metadata_json,
        )
        db.add(trace)
        db.flush()

        if payload.retrieval is not None:
            db.add(
                RetrievalSpan(
                    trace_id=trace.id,
                    retrieval_latency_ms=payload.retrieval.retrieval_latency_ms,
                    source_count=payload.retrieval.source_count,
                    top_k=payload.retrieval.top_k,
                    query_text=payload.retrieval.query_text,
                    retrieved_chunks_json=payload.retrieval.retrieved_chunks_json,
                )
            )

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
    enqueue_trace_evaluations(trace.id)
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
        .options(selectinload(Trace.retrieval_span), selectinload(Trace.evaluations))
        .where(Trace.id == trace_id, Trace.organization_id.in_(operator.organization_ids))
    )
    trace = db.scalar(statement)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    trace.evaluations.sort(key=lambda item: (item.eval_type, item.created_at))
    return trace
