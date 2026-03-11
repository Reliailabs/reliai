from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.evaluation import Evaluation
from app.models.incident import Incident
from app.models.incident_root_cause import IncidentRootCause
from app.models.model_version import ModelVersion
from app.models.prompt_version import PromptVersion
from app.models.regression_snapshot import RegressionSnapshot
from app.models.reliability_graph_edge import ReliabilityGraphEdge
from app.models.reliability_graph_node import ReliabilityGraphNode
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.models.trace_evaluation import TraceEvaluation
from app.models.trace_retrieval_span import TraceRetrievalSpan
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window

NODE_MODEL_FAMILY = "model_family"
NODE_PROMPT_VERSION = "prompt_version"
NODE_RETRIEVAL_STRATEGY = "retrieval_strategy"
NODE_GUARDRAIL_POLICY = "guardrail_policy"
NODE_DEPLOYMENT = "deployment"
NODE_INCIDENT = "incident"
NODE_FAILURE_MODE = "failure_mode"

REL_MODEL_PROMPT = "model_to_prompt"
REL_PROMPT_GUARDRAIL = "prompt_to_guardrail"
REL_MODEL_INCIDENT = "model_to_incident"
REL_RETRIEVAL_FAILURE = "retrieval_to_failure"
REL_DEPLOYMENT_INCIDENT = "deployment_to_incident"
REL_MODEL_DEPLOYMENT = "model_to_deployment"

HIGH_RISK_CONFIDENCE = 0.2
HIGH_RISK_TRACE_MINIMUM = 3


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

    return query_trace_window(
        db,
        TraceWindowQuery(
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            environment_id=incident.environment_id,
            window_start=window_start,
            window_end=window_end,
            prompt_version=summary.get("scope_id") if summary.get("scope_type") == "prompt_version" else None,
            with_details=True,
            limit=25,
        ),
    )


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
        .where(Incident.id == incident_id)
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    require_project_access(db, operator, incident.project_id)

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
    evaluations = []
    if trace_ids:
        evaluations = db.scalars(
            select(TraceEvaluation)
            .where(TraceEvaluation.trace_id.in_(trace_ids))
            .order_by(desc(TraceEvaluation.created_at))
        ).all()
    if not evaluations:
        seen_ids = set()
        synthesized = []
        for trace in graph_traces:
            for evaluation in getattr(trace, "graph_evaluations", []):
                if evaluation.id in seen_ids:
                    continue
                synthesized.append(evaluation)
                seen_ids.add(evaluation.id)
        evaluations = synthesized

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


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def upsert_graph_node(
    db: Session,
    *,
    organization_id: UUID | None,
    project_id: UUID | None,
    node_type: str,
    node_key: str,
    metadata_json: dict | None,
    observed_at: datetime,
) -> ReliabilityGraphNode:
    observed_at = _as_utc(observed_at)
    node = db.scalar(
        select(ReliabilityGraphNode).where(
            ReliabilityGraphNode.organization_id == organization_id,
            ReliabilityGraphNode.project_id == project_id,
            ReliabilityGraphNode.node_type == node_type,
            ReliabilityGraphNode.node_key == node_key,
        )
    )
    if node is None:
        node = ReliabilityGraphNode(
            organization_id=organization_id,
            project_id=project_id,
            node_type=node_type,
            node_key=node_key,
            metadata_json=metadata_json,
            first_seen=observed_at,
            last_seen=observed_at,
            trace_count=0,
        )
    node.last_seen = observed_at
    first_seen = _as_utc(node.first_seen) if node.first_seen is not None else None
    if first_seen is None or observed_at < first_seen:
        node.first_seen = observed_at
    node.trace_count = int(node.trace_count or 0) + 1
    node.metadata_json = {**(node.metadata_json or {}), **(metadata_json or {})} if metadata_json else node.metadata_json
    db.add(node)
    db.flush()
    return node


def upsert_graph_edge(
    db: Session,
    *,
    organization_id: UUID | None,
    project_id: UUID | None,
    source: ReliabilityGraphNode,
    target: ReliabilityGraphNode,
    relationship_type: str,
) -> ReliabilityGraphEdge:
    edge = db.scalar(
        select(ReliabilityGraphEdge).where(
            ReliabilityGraphEdge.organization_id == organization_id,
            ReliabilityGraphEdge.project_id == project_id,
            ReliabilityGraphEdge.source_id == source.id,
            ReliabilityGraphEdge.target_id == target.id,
            ReliabilityGraphEdge.relationship_type == relationship_type,
        )
    )
    if edge is None:
        edge = ReliabilityGraphEdge(
            organization_id=organization_id,
            project_id=project_id,
            source_type=source.node_type,
            source_id=source.id,
            target_type=target.node_type,
            target_id=target.id,
            relationship_type=relationship_type,
            weight=0.0,
            confidence=0.0,
            trace_count=0,
        )
    edge.weight = float(edge.weight or 0.0) + 1.0
    edge.trace_count = int(edge.trace_count or 0) + 1
    source_total = max(int(source.trace_count or 0), 1)
    edge.confidence = round(min(1.0, edge.trace_count / source_total), 4)
    db.add(edge)
    db.flush()
    return edge


def get_related_nodes(
    db: Session,
    *,
    node_id: UUID,
    organization_ids: list[UUID] | None,
) -> tuple[ReliabilityGraphNode | None, list[tuple[ReliabilityGraphNode, ReliabilityGraphEdge]]]:
    node = db.get(ReliabilityGraphNode, node_id)
    if node is None:
        return None, []
    if organization_ids is not None and node.organization_id is not None and node.organization_id not in organization_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    rows = db.execute(
        select(ReliabilityGraphNode, ReliabilityGraphEdge)
        .join(
            ReliabilityGraphEdge,
            or_(
                ReliabilityGraphEdge.target_id == ReliabilityGraphNode.id,
                ReliabilityGraphEdge.source_id == ReliabilityGraphNode.id,
            ),
        )
        .where(
            or_(
                ReliabilityGraphEdge.source_id == node_id,
                ReliabilityGraphEdge.target_id == node_id,
            )
        )
        .order_by(desc(ReliabilityGraphEdge.confidence), desc(ReliabilityGraphEdge.weight))
        .limit(20)
    ).all()
    related: list[tuple[ReliabilityGraphNode, ReliabilityGraphEdge]] = []
    for related_node, edge in rows:
        if related_node.id == node_id:
            continue
        if organization_ids is not None and related_node.organization_id is not None and related_node.organization_id not in organization_ids:
            continue
        related.append((related_node, edge))
    return node, related


def _edge_pattern(edge: ReliabilityGraphEdge, source: ReliabilityGraphNode, target: ReliabilityGraphNode) -> dict:
    pattern = f"{source.node_key} + {target.node_key}"
    risk_level = "high" if edge.confidence >= 0.45 else "medium" if edge.confidence >= 0.25 else "low"
    return {
        "pattern": pattern,
        "risk_level": risk_level,
        "traces": edge.trace_count,
        "confidence": round(float(edge.confidence), 4),
        "source_node_id": str(source.id),
        "target_node_id": str(target.id),
        "source_type": source.node_type,
        "source_key": source.node_key,
        "target_type": target.node_type,
        "target_key": target.node_key,
        "relationship_type": edge.relationship_type,
    }


def get_high_risk_patterns(
    db: Session,
    *,
    organization_ids: list[UUID] | None,
    project_id: UUID | None = None,
    limit: int = 25,
) -> list[dict]:
    statement = (
        select(ReliabilityGraphEdge)
        .options(
            joinedload(ReliabilityGraphEdge.source),
            joinedload(ReliabilityGraphEdge.target),
        )
        .where(
            ReliabilityGraphEdge.confidence >= HIGH_RISK_CONFIDENCE,
            ReliabilityGraphEdge.trace_count >= HIGH_RISK_TRACE_MINIMUM,
        )
        .order_by(desc(ReliabilityGraphEdge.confidence), desc(ReliabilityGraphEdge.weight))
        .limit(limit)
    )
    if organization_ids is not None:
        statement = statement.where(
            or_(
                ReliabilityGraphEdge.organization_id.is_(None),
                ReliabilityGraphEdge.organization_id.in_(organization_ids),
            )
        )
    if project_id is not None:
        statement = statement.where(
            or_(
                ReliabilityGraphEdge.project_id.is_(None),
                ReliabilityGraphEdge.project_id == project_id,
            )
        )
    edges = db.scalars(statement).unique().all()
    return [_edge_pattern(edge, edge.source, edge.target) for edge in edges if edge.source and edge.target]


def get_graph_guardrail_recommendations(
    db: Session,
    *,
    organization_ids: list[UUID] | None,
    project_id: UUID | None = None,
) -> list[dict]:
    patterns = get_high_risk_patterns(
        db,
        organization_ids=organization_ids,
        project_id=project_id,
        limit=50,
    )
    recommendations: list[dict] = []
    for item in patterns:
        relationship = item["relationship_type"]
        pattern_text = str(item["pattern"])
        confidence = float(item["confidence"])
        model_family = (
            str(item["source_key"])
            if item.get("source_type") == NODE_MODEL_FAMILY
            else str(item["target_key"])
            if item.get("target_type") == NODE_MODEL_FAMILY
            else None
        )
        if "latency" in pattern_text or relationship == REL_RETRIEVAL_FAILURE:
            recommendations.append(
                {
                    "policy_type": "latency_retry",
                    "recommended_action": "retry",
                    "title": "Add latency retry guardrail coverage",
                    "description": f"Graph correlations show latency pressure around {pattern_text}.",
                    "confidence": confidence,
                    "pattern": pattern_text,
                    "model_family": model_family,
                }
            )
        if "incident" in pattern_text or relationship == REL_MODEL_INCIDENT:
            recommendations.append(
                {
                    "policy_type": "hallucination",
                    "recommended_action": "retry",
                    "title": "Add hallucination guardrail coverage",
                    "description": f"Graph correlations tie the current model or prompt shape to repeated incidents: {pattern_text}.",
                    "confidence": confidence,
                    "pattern": pattern_text,
                    "model_family": model_family,
                }
            )
        if "structured_output" in pattern_text:
            recommendations.append(
                {
                    "policy_type": "structured_output",
                    "recommended_action": "retry",
                    "title": "Strengthen structured output guardrails",
                    "description": f"Graph correlations show structured output failures for {pattern_text}.",
                    "confidence": confidence,
                    "pattern": pattern_text,
                    "model_family": model_family,
                }
            )
    unique: list[dict] = []
    seen: set[str] = set()
    for item in recommendations:
        key = str(item["policy_type"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    if unique or not patterns:
        return unique
    top_pattern = patterns[0]
    return [
        {
            "policy_type": "structured_output",
            "recommended_action": "retry",
            "title": "Add baseline structured output guardrail coverage",
            "description": (
                "Graph correlations show repeated reliability patterns for "
                f"{top_pattern['pattern']}. Start with a structured output retry guardrail."
            ),
            "confidence": float(top_pattern["confidence"]),
            "pattern": str(top_pattern["pattern"]),
            "model_family": (
                str(top_pattern["source_key"])
                if top_pattern.get("source_type") == NODE_MODEL_FAMILY
                else None
            ),
        }
    ]


def get_model_failure_graph(
    db: Session,
    *,
    model_family: str | None,
    organization_ids: list[UUID] | None,
    project_id: UUID | None = None,
) -> dict:
    if not model_family:
        return {"risk_score": 0.0, "patterns": []}
    statement = (
        select(ReliabilityGraphEdge)
        .join(ReliabilityGraphNode, ReliabilityGraphEdge.source_id == ReliabilityGraphNode.id)
        .options(joinedload(ReliabilityGraphEdge.source), joinedload(ReliabilityGraphEdge.target))
        .where(
            ReliabilityGraphEdge.source_type == NODE_MODEL_FAMILY,
            ReliabilityGraphNode.node_key == model_family,
        )
        .order_by(desc(ReliabilityGraphEdge.confidence), desc(ReliabilityGraphEdge.weight))
        .limit(10)
    )
    if organization_ids is not None:
        statement = statement.where(
            or_(
                ReliabilityGraphEdge.organization_id.is_(None),
                ReliabilityGraphEdge.organization_id.in_(organization_ids),
            )
        )
    if project_id is not None:
        statement = statement.where(
            or_(
                ReliabilityGraphEdge.project_id.is_(None),
                ReliabilityGraphEdge.project_id == project_id,
            )
        )
    edges = db.scalars(statement).unique().all()
    patterns = [_edge_pattern(edge, edge.source, edge.target) for edge in edges if edge.source and edge.target]
    risk_score = round(min(0.2, sum(float(edge.confidence) * 0.1 for edge in edges[:3])), 4)
    return {"risk_score": risk_score, "patterns": patterns}


def get_global_pattern_summaries(db: Session, *, limit: int = 25) -> list[dict]:
    rows = db.execute(
        select(
            ReliabilityGraphNode.node_key.label("model_family"),
            ReliabilityGraphEdge.relationship_type,
            ReliabilityGraphNode.id.label("source_node_id"),
            ReliabilityGraphEdge.target_id,
            func.max(ReliabilityGraphEdge.confidence).label("confidence"),
            func.sum(ReliabilityGraphEdge.trace_count).label("trace_count"),
            func.count(func.distinct(ReliabilityGraphEdge.organization_id)).label("organizations_affected"),
            func.min(ReliabilityGraphEdge.created_at).label("first_seen"),
        )
        .join(ReliabilityGraphNode, ReliabilityGraphEdge.source_id == ReliabilityGraphNode.id)
        .where(
            ReliabilityGraphEdge.source_type == NODE_MODEL_FAMILY,
            ReliabilityGraphEdge.confidence >= HIGH_RISK_CONFIDENCE,
            ReliabilityGraphEdge.trace_count >= HIGH_RISK_TRACE_MINIMUM,
        )
        .group_by(
            ReliabilityGraphNode.node_key,
            ReliabilityGraphEdge.relationship_type,
            ReliabilityGraphNode.id,
            ReliabilityGraphEdge.target_id,
        )
        .order_by(desc("confidence"), desc("trace_count"))
        .limit(limit)
    ).all()
    target_nodes = {
        node.id: node
        for node in db.scalars(
            select(ReliabilityGraphNode).where(
                ReliabilityGraphNode.id.in_([row.target_id for row in rows])  # type: ignore[attr-defined]
            )
        ).all()
    } if rows else {}
    items: list[dict] = []
    for row in rows:
        target = target_nodes.get(row.target_id)
        target_key = target.node_key if target is not None else "unknown"
        risk_level = "high" if float(row.confidence or 0) >= 0.45 else "medium"
        items.append(
            {
                "model_family": row.model_family,
                "issue": f"{row.model_family} + {target_key}",
                "risk_level": risk_level,
                "organizations_affected": int(row.organizations_affected or 0),
                "trace_count": int(row.trace_count or 0),
                "first_seen": row.first_seen,
                "recommended_guardrail": "latency_retry"
                if row.relationship_type == REL_RETRIEVAL_FAILURE
                else "hallucination"
                if row.relationship_type == REL_MODEL_INCIDENT
                else "structured_output",
                "confidence": round(float(row.confidence or 0), 4),
                "pattern": f"{row.model_family} + {target_key}",
            }
        )
    return items
