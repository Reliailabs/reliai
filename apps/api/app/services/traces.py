import base64
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone as trace_timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.events import build_trace_event_payload, validate_trace_event
from app.models.project import Project
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.schemas.trace import TraceIngestRequest, TraceListQuery
from app.services.auth import OperatorContext
from app.services.authorization import authorized_project_ids, require_project_access, require_trace_access
from app.services.event_stream import PIPELINE_BACKPRESSURE_EVENT, TRACE_INGESTED_EVENT, publish_event
from app.services.environments import normalize_environment_name, resolve_project_environment
from app.services.guardrails import evaluate_trace_guardrails
from app.services.incidents import _structured_output_label
from app.services.onboarding import mark_trace_ingested
from app.services.reliability_graph import sync_trace_retrieval_span
from app.services.registry import link_trace_registry_records
from app.services.trace_ingestion_control import apply_trace_ingestion_controls
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window
from app.services.trace_query_router import WarehouseQueryViolation
from app.core.settings import get_settings
from app.services.rate_limiter import enforce_rate_limit
from app.services.usage_quotas import enforce_daily_trace_quota

logger = logging.getLogger(__name__)
PREVIEW_LENGTH = 240
MAX_RELATIONAL_TRACE_SCAN_WINDOW = timedelta(hours=24)


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


@dataclass(frozen=True)
class TraceSummaryResult:
    trace_id: str
    service_name: str | None
    model_name: str
    latency_ms: int | None
    guardrail_retries: int
    error_summary: str | None


def _build_preview(value: str | None) -> str | None:
    if value is None:
        return None
    compact = " ".join(value.split())
    return compact[:PREVIEW_LENGTH] if compact else None


def _trace_identity(payload: TraceIngestRequest) -> tuple[str | None, str | None, str | None, str | None, str | None, str | None]:
    metadata = payload.metadata_json or {}
    return (
        payload.trace_id or str(metadata.get("reliai_trace_id") or metadata.get("trace_id") or "").strip() or None,
        payload.span_id or str(metadata.get("reliai_span_id") or metadata.get("span_id") or "").strip() or None,
        payload.parent_span_id or str(metadata.get("reliai_parent_span_id") or metadata.get("parent_span_id") or "").strip() or None,
        payload.span_name or str(metadata.get("span_name") or "").strip() or None,
        payload.guardrail_policy or str(metadata.get("guardrail_policy") or "").strip() or None,
        payload.guardrail_action or str(metadata.get("guardrail_action") or "").strip() or None,
    )


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
        payload = validate_trace_event(
            build_trace_event_payload(
                trace,
                event_type=TRACE_INGESTED_EVENT,
            )
        )
        publish_event(settings.event_stream_topic_traces, payload)
    except Exception:
        logger.exception("failed to publish trace ingest event", extra={"trace_id": str(trace.id)})


def create_trace(db: Session, project: Project, payload: TraceIngestRequest) -> Trace:
    try:
        trace_row_id = uuid4()
        environment = resolve_project_environment(
            db,
            project=project,
            name=payload.environment,
        )
        trace_id, span_id, parent_span_id, span_name, guardrail_policy, guardrail_action = _trace_identity(payload)
        is_explainable = bool(
            payload.model_name
            and payload.prompt_version
            and payload.latency_ms is not None
            and payload.prompt_tokens is not None
            and payload.completion_tokens is not None
        )
        trace = Trace(
            id=trace_row_id,
            organization_id=project.organization_id,
            project_id=project.id,
            environment_id=environment.id,
            environment=environment.name,
            timestamp=payload.timestamp,
            request_id=payload.request_id,
            service_name=payload.service_name,
            trace_id=trace_id or str(trace_row_id),
            span_id=span_id or str(trace_row_id),
            parent_span_id=parent_span_id,
            span_name=span_name,
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
            guardrail_policy=guardrail_policy,
            guardrail_action=guardrail_action,
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

        try:
            validate_trace_event(
                build_trace_event_payload(
                    trace,
                    event_type=TRACE_INGESTED_EVENT,
                )
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

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
    enforce_daily_trace_quota(db, organization_id=project.organization_id)
    publish_event_after_commit = True
    settings = get_settings()
    now = datetime.now(trace_timezone.utc)
    try:
        enforce_rate_limit(
            scope="trace_ingest_global",
            key=now.strftime("%Y%m%d%H%M%S"),
            limit=settings.max_traces_per_second,
            window_seconds=1,
        )
        enforce_rate_limit(
            scope="trace_ingest_project",
            key=f"{project.id}:{now.strftime('%Y%m%d%H%M%S')}",
            limit=settings.max_project_ingest_rate,
            window_seconds=1,
        )
    except HTTPException:
        publish_event_after_commit = False
    controlled = apply_trace_ingestion_controls(db, project=project, payload=payload)
    trace = create_trace(db, project, controlled.payload)
    if publish_event_after_commit and controlled.publish_event:
        publish_trace_ingested_event(trace)
    elif not publish_event_after_commit:
        publish_event(
            settings.event_stream_topic_traces,
            {
                "event_type": PIPELINE_BACKPRESSURE_EVENT,
                "project_id": str(project.id),
                "environment_id": str(trace.environment_id) if trace.environment_id is not None else None,
                "timestamp": datetime.now(trace_timezone.utc).isoformat(),
                "metadata": {
                    "trace_id": str(trace.id),
                    "sampled": True,
                },
            },
        )
    return trace


def list_traces(db: Session, operator: OperatorContext, filters: TraceListQuery) -> TraceListResult:
    if filters.date_from is not None and filters.date_to is not None:
        window = filters.date_to - filters.date_from
        if window > MAX_RELATIONAL_TRACE_SCAN_WINDOW:
            raise WarehouseQueryViolation()
    if filters.project_id is not None:
        require_project_access(db, operator, filters.project_id)
        allowed_project_ids = [filters.project_id]
    else:
        allowed_project_ids = authorized_project_ids(db, operator)

    statement = (
        select(Trace)
        .where(Trace.project_id.in_(allowed_project_ids))
        .order_by(desc(Trace.created_at), desc(Trace.id))
    )

    if filters.project_id is not None:
        statement = statement.where(Trace.project_id == filters.project_id)
    if filters.environment is not None:
        statement = statement.where(Trace.environment == normalize_environment_name(filters.environment))
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
        .where(Trace.id == trace_id)
    )
    trace = db.scalar(statement)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    require_project_access(db, operator, trace.project_id)
    trace.evaluations.sort(key=lambda item: (item.eval_type, item.created_at))
    return trace


def get_trace_detail_by_identifier(db: Session, operator: OperatorContext, trace_identifier: str) -> Trace:
    trace = resolve_trace_identifier(db, trace_identifier)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    try:
        require_project_access(db, operator, trace.project_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found") from exc
        raise
    trace.evaluations.sort(key=lambda item: (item.eval_type, item.created_at))
    return trace


def get_trace_summary_by_identifier(db: Session, trace_identifier: str) -> dict[str, object]:
    trace = resolve_trace_identifier(db, trace_identifier)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")

    trace_group = list(
        db.scalars(
            select(Trace)
            .where(Trace.trace_id == trace.trace_id)
            .order_by(Trace.parent_span_id.isnot(None), Trace.created_at.asc())
        ).all()
    )
    anchor = trace_group[0] if trace_group else trace
    service_name = anchor.service_name or (anchor.metadata_json or {}).get("service_name")
    summary = TraceSummaryResult(
        trace_id=anchor.trace_id,
        service_name=service_name if isinstance(service_name, str) else None,
        model_name=anchor.model_name,
        latency_ms=anchor.latency_ms,
        guardrail_retries=sum(1 for item in trace_group if _trace_has_guardrail_retry(item)),
        error_summary=_trace_error_summary(anchor),
    )
    return summary.__dict__


def resolve_trace_identifier(db: Session, trace_identifier: str) -> Trace | None:
    statement = (
        select(Trace)
        .options(
            selectinload(Trace.retrieval_span),
            selectinload(Trace.evaluations),
            selectinload(Trace.prompt_version_record),
            selectinload(Trace.model_version_record),
        )
    )

    try:
        trace_uuid = UUID(trace_identifier)
    except ValueError:
        trace_uuid = None

    if trace_uuid is not None:
        trace = db.scalar(statement.where(Trace.id == trace_uuid))
        if trace is not None:
            return trace

    return db.scalars(
        statement.where(Trace.trace_id == trace_identifier).order_by(Trace.parent_span_id.isnot(None), Trace.created_at.asc())
    ).first()


def _trace_has_guardrail_retry(trace: Trace) -> bool:
    metadata = trace.metadata_json or {}
    if metadata.get("guardrail_retry") is True:
        return True
    retries = metadata.get("guardrail_retries") or metadata.get("guardrail_retry_count") or metadata.get("retry_count")
    return isinstance(retries, int) and retries > 0


def _trace_error_summary(trace: Trace) -> str | None:
    metadata = trace.metadata_json or {}
    for key in ("error_summary", "incident_summary", "recommendation"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if trace.error_type and trace.output_preview:
        return f"{trace.error_type}: {trace.output_preview}"
    if trace.error_type:
        return trace.error_type
    if trace.guardrail_policy and trace.guardrail_action:
        return f"{trace.guardrail_policy} {trace.guardrail_action}"
    if trace.output_preview:
        return trace.output_preview
    return None


def _numeric_distance(left: int | Decimal | None, right: int | Decimal | None) -> float:
    if left is None or right is None:
        return float("inf")
    return abs(float(left) - float(right))


def _coerce_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=trace_timezone.utc)
    return value.astimezone(trace_timezone.utc)


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
        _coerce_utc_datetime(candidate.timestamp),
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
    trace_timestamp = _coerce_utc_datetime(trace.timestamp)
    baseline_window_end = trace_timestamp
    current_window_start = trace_timestamp
    current_window_end = trace_timestamp

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
                    environment_id=trace.environment_id,
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
            and _coerce_utc_datetime(candidate.timestamp) < trace_timestamp
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
                    environment_id=trace.environment_id,
                    window_start=baseline_window_start,
                    window_end=baseline_window_end,
                    with_details=True,
                    limit=100,
                ),
            )
            if candidate.id != trace.id
            and _coerce_utc_datetime(candidate.timestamp) < trace_timestamp
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
