from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import SessionLocal
from app.models.reliability_graph_edge import ReliabilityGraphEdge
from app.models.reliability_pattern import ReliabilityPattern
from app.services.reliability_graph import NODE_MODEL_FAMILY, NODE_PROMPT_VERSION
from app.services.reliability_graph import HIGH_RISK_CONFIDENCE, HIGH_RISK_TRACE_MINIMUM


def run_reliability_graph_mining_for_session(db, *, anchor_time: str | None = None) -> None:
    computed_at = (
        datetime.fromisoformat(anchor_time).astimezone(timezone.utc)
        if anchor_time is not None
        else datetime.now(timezone.utc)
    )
    edges = db.scalars(
        select(ReliabilityGraphEdge)
        .options(joinedload(ReliabilityGraphEdge.source), joinedload(ReliabilityGraphEdge.target))
        .where(
            ReliabilityGraphEdge.confidence >= HIGH_RISK_CONFIDENCE,
            ReliabilityGraphEdge.trace_count >= HIGH_RISK_TRACE_MINIMUM,
        )
    ).all()
    for edge in edges:
        model_family = None
        prompt_pattern_hash = None
        if edge.source is not None and edge.source.node_type == NODE_MODEL_FAMILY:
            model_family = edge.source.node_key
        elif edge.target is not None and edge.target.node_type == NODE_MODEL_FAMILY:
            model_family = edge.target.node_key
        if edge.source is not None and edge.source.node_type == NODE_PROMPT_VERSION:
            prompt_pattern_hash = edge.source.node_key
        elif edge.target is not None and edge.target.node_type == NODE_PROMPT_VERSION:
            prompt_pattern_hash = edge.target.node_key
        record = db.scalar(
            select(ReliabilityPattern).where(
                ReliabilityPattern.pattern_type == "graph_correlation",
                ReliabilityPattern.failure_type == edge.relationship_type,
                ReliabilityPattern.model_family == model_family,
                ReliabilityPattern.prompt_pattern_hash == prompt_pattern_hash,
            )
        )
        if record is None:
            record = ReliabilityPattern(
                pattern_type="graph_correlation",
                model_family=model_family,
                prompt_pattern_hash=prompt_pattern_hash,
                failure_type=edge.relationship_type,
                failure_probability=float(edge.confidence),
                sample_count=int(edge.trace_count),
                first_seen_at=edge.created_at,
                last_seen_at=computed_at,
            )
        else:
            record.failure_probability = max(float(record.failure_probability), float(edge.confidence))
            record.sample_count = max(int(record.sample_count), int(edge.trace_count))
            record.last_seen_at = computed_at
        db.add(record)
    db.commit()


def run_reliability_graph_mining(anchor_time: str | None = None) -> None:
    db = SessionLocal()
    try:
        run_reliability_graph_mining_for_session(db, anchor_time=anchor_time)
    finally:
        db.close()
