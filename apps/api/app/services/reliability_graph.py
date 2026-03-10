from __future__ import annotations

from collections import Counter
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.evaluation import Evaluation
from app.models.incident import Incident
from app.models.incident_root_cause import IncidentRootCause
from app.models.model_version import ModelVersion
from app.models.prompt_version import PromptVersion
from app.models.regression_snapshot import RegressionSnapshot
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.models.trace_evaluation import TraceEvaluation
from app.models.trace_retrieval_span import TraceRetrievalSpan
from app.services.auth import OperatorContext


def sync_trace_evaluation(db: Session, *, evaluation: Evaluation) -> TraceEvaluation:
    graph_row = db.scalar(
        select(TraceEvaluation).where(
            TraceEvaluation.trace_id == evaluation.trace_id,
            TraceEvaluation.evaluation_type == evaluation.eval_type,
        )
    )
    if graph_row is None:
        graph_row = TraceEvaluation(trace_id=evaluation.trace_id, evaluation_type=evaluation.eval_type)
    graph_row.score = evaluation.score
    graph_row.metadata_json = {
        "label": evaluation.label,
        "explanation": evaluation.explanation,
        "evaluator_provider": evaluation.evaluator_provider,
        "evaluator_model": evaluation.evaluator_model,
        "evaluator_version": evaluation.evaluator_version,
        "raw_result_json": evaluation.raw_result_json,
    }
    db.add(graph_row)
    db.flush()
    return graph_row


def sync_trace_retrieval_span(
    db: Session,
    *,
    trace_id,
    retrieval_provider: str | None,
    retrieval_span: RetrievalSpan | None,
) -> TraceRetrievalSpan | None:
    if retrieval_span is None:
        return None
    graph_row = db.scalar(select(TraceRetrievalSpan).where(TraceRetrievalSpan.trace_id == trace_id))
    if graph_row is None:
        graph_row = TraceRetrievalSpan(trace_id=trace_id)
    graph_row.retrieval_provider = retrieval_provider
    graph_row.latency_ms = retrieval_span.retrieval_latency_ms
    graph_row.chunk_count = retrieval_span.source_count
    graph_row.metadata_json = {
        "top_k": retrieval_span.top_k,
        "query_text": retrieval_span.query_text,
        "retrieved_chunks_json": retrieval_span.retrieved_chunks_json,
    }
    db.add(graph_row)
    db.flush()
    return graph_row


def _incident_window_traces(db: Session, *, incident: Incident) -> list[Trace]:
    summary = incident.summary_json or {}
    window_start = summary.get("current_window_start")
    window_end = summary.get("current_window_end")
    if window_start is None or window_end is None:
        return []
    if isinstance(window_start, str):
        window_start = datetime.fromisoformat(window_start)
    if isinstance(window_end, str):
        window_end = datetime.fromisoformat(window_end)

    statement = (
        select(Trace)
        .options(
            selectinload(Trace.prompt_version_record),
            selectinload(Trace.model_version_record),
            selectinload(Trace.graph_evaluations),
            selectinload(Trace.graph_retrieval_span),
        )
        .where(
            Trace.organization_id == incident.organization_id,
            Trace.project_id == incident.project_id,
            Trace.timestamp >= window_start,
            Trace.timestamp < window_end,
        )
        .order_by(desc(Trace.timestamp), desc(Trace.id))
    )
    if summary.get("scope_type") == "prompt_version":
        statement = statement.where(Trace.prompt_version == summary.get("scope_id"))
    return db.scalars(statement.limit(25)).unique().all()


def sync_incident_root_causes(db: Session, *, incident: Incident) -> list[IncidentRootCause]:
    traces = _incident_window_traces(db, incident=incident)
    db.execute(delete(IncidentRootCause).where(IncidentRootCause.incident_id == incident.id))

    rows: list[IncidentRootCause] = []
    if not traces:
        return rows

    def add_root_cause(cause_type: str, cause_id: str, count: int, trace_ids: list[str], extra: dict | None = None):
        rows.append(
            IncidentRootCause(
                incident_id=incident.id,
                cause_type=cause_type,
                cause_id=cause_id,
                confidence_score=Decimal(count) / Decimal(len(traces)),
                evidence_json={
                    "count": count,
                    "total_traces": len(traces),
                    "supporting_trace_ids": trace_ids,
                    **(extra or {}),
                },
            )
        )

    prompt_counts = Counter()
    prompt_trace_ids: dict[str, list[str]] = {}
    model_counts = Counter()
    model_trace_ids: dict[str, list[str]] = {}
    error_counts = Counter()
    error_trace_ids: dict[str, list[str]] = {}

    for trace in traces:
        prompt_key = str(trace.prompt_version_record_id) if trace.prompt_version_record_id is not None else trace.prompt_version
        if prompt_key:
            prompt_counts[prompt_key] += 1
            prompt_trace_ids.setdefault(prompt_key, []).append(str(trace.id))

        model_key = str(trace.model_version_record_id) if trace.model_version_record_id is not None else trace.model_name
        if model_key:
            model_counts[model_key] += 1
            model_trace_ids.setdefault(model_key, []).append(str(trace.id))

        if trace.error_type:
            error_counts[trace.error_type] += 1
            error_trace_ids.setdefault(trace.error_type, []).append(str(trace.id))

    if prompt_counts:
        cause_id, count = prompt_counts.most_common(1)[0]
        add_root_cause("prompt_version", cause_id, count, prompt_trace_ids[cause_id])
    if model_counts:
        cause_id, count = model_counts.most_common(1)[0]
        add_root_cause("model_version", cause_id, count, model_trace_ids[cause_id])
    if error_counts:
        cause_id, count = error_counts.most_common(1)[0]
        add_root_cause("error_type", cause_id, count, error_trace_ids[cause_id])

    db.add_all(rows)
    db.flush()
    return rows


def get_incident_graph(db: Session, operator: OperatorContext, incident_id: UUID) -> dict:
    incident = db.scalar(
        select(Incident)
        .options(joinedload(Incident.project), selectinload(Incident.root_causes))
        .where(Incident.id == incident_id, Incident.organization_id.in_(operator.organization_ids))
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    summary = incident.summary_json or {}
    regression_snapshot_ids = [UUID(value) for value in summary.get("regression_snapshot_ids", [])]
    sample_trace_ids = [UUID(value) for value in summary.get("sample_trace_ids", [])]

    regressions = []
    if regression_snapshot_ids:
        regressions = db.scalars(
            select(RegressionSnapshot)
            .where(RegressionSnapshot.id.in_(regression_snapshot_ids))
            .order_by(desc(RegressionSnapshot.detected_at))
        ).all()

    graph_traces = _incident_window_traces(db, incident=incident)
    if sample_trace_ids:
        sample_traces = (
            db.scalars(
                select(Trace)
                .options(
                    selectinload(Trace.prompt_version_record),
                    selectinload(Trace.model_version_record),
                    selectinload(Trace.graph_evaluations),
                    selectinload(Trace.graph_retrieval_span),
                )
                .where(Trace.id.in_(sample_trace_ids))
                .order_by(desc(Trace.timestamp))
            )
            .unique()
            .all()
        )
        seen_ids = {trace.id for trace in graph_traces}
        graph_traces.extend([trace for trace in sample_traces if trace.id not in seen_ids])

    graph_traces = graph_traces[:10]
    trace_ids = [trace.id for trace in graph_traces]
    evaluations = (
        db.scalars(
            select(TraceEvaluation)
            .where(TraceEvaluation.trace_id.in_(trace_ids))
            .order_by(desc(TraceEvaluation.created_at))
        ).all()
        if trace_ids
        else []
    )

    prompt_version = None
    model_version = None
    for root_cause in incident.root_causes:
        if root_cause.cause_type == "prompt_version":
            try:
                prompt_version = db.get(PromptVersion, UUID(root_cause.cause_id))
            except ValueError:
                prompt_version = None
        if root_cause.cause_type == "model_version":
            try:
                model_version = db.get(ModelVersion, UUID(root_cause.cause_id))
            except ValueError:
                model_version = None

    if prompt_version is None:
        prompt_version = next(
            (trace.prompt_version_record for trace in graph_traces if trace.prompt_version_record is not None),
            None,
        )
    if model_version is None:
        model_version = next(
            (trace.model_version_record for trace in graph_traces if trace.model_version_record is not None),
            None,
        )

    return {
        "incident": incident,
        "regressions": regressions,
        "traces": graph_traces,
        "prompt_version": prompt_version,
        "model_version": model_version,
        "deployment": None,
        "evaluations": evaluations,
        "root_causes": incident.root_causes,
    }
