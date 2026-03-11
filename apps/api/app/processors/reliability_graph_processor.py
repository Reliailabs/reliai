from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.trace import Trace
from app.processors.base_processor import BaseProcessor
from app.services.event_stream import (
    INCIDENT_CREATED_EVENT,
    REGRESSION_DETECTED_EVENT,
    TRACE_EVALUATED_EVENT,
    TRACE_INGESTED_EVENT,
)
from app.services.reliability_graph import (
    NODE_DEPLOYMENT,
    NODE_FAILURE_MODE,
    NODE_GUARDRAIL_POLICY,
    NODE_INCIDENT,
    NODE_MODEL_FAMILY,
    NODE_PROMPT_VERSION,
    NODE_RETRIEVAL_STRATEGY,
    REL_DEPLOYMENT_INCIDENT,
    REL_MODEL_DEPLOYMENT,
    REL_MODEL_INCIDENT,
    REL_MODEL_PROMPT,
    REL_PROMPT_GUARDRAIL,
    REL_RETRIEVAL_FAILURE,
    upsert_graph_edge,
    upsert_graph_node,
)


def _parse_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def _record_trace_nodes(db, trace: Trace, payload: dict) -> None:
    observed_at = _parse_timestamp(str(payload.get("timestamp") or trace.timestamp.isoformat()))
    metadata = payload.get("metadata") or trace.metadata_json or {}
    model_family = ((payload.get("model") or {}).get("family")) or metadata.get("__model_name") or trace.model_name
    prompt_version_key = str(payload.get("prompt_version_id") or trace.prompt_version_record_id or trace.prompt_version or "unknown")
    model_node = upsert_graph_node(
        db,
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        node_type=NODE_MODEL_FAMILY,
        node_key=str(model_family),
        metadata_json={"provider": trace.model_provider},
        observed_at=observed_at,
    )
    prompt_node = upsert_graph_node(
        db,
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        node_type=NODE_PROMPT_VERSION,
        node_key=prompt_version_key,
        metadata_json={"prompt_version": trace.prompt_version},
        observed_at=observed_at,
    )
    upsert_graph_edge(
        db,
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        source=model_node,
        target=prompt_node,
        relationship_type=REL_MODEL_PROMPT,
    )

    if trace.model_version_record_id is not None:
        deployment_node = upsert_graph_node(
            db,
            organization_id=trace.organization_id,
            project_id=trace.project_id,
            node_type=NODE_DEPLOYMENT,
            node_key=str(trace.model_version_record_id),
            metadata_json={"deployment_hint": "model_version"},
            observed_at=observed_at,
        )
        upsert_graph_edge(
            db,
            organization_id=trace.organization_id,
            project_id=trace.project_id,
            source=model_node,
            target=deployment_node,
            relationship_type=REL_MODEL_DEPLOYMENT,
        )

    retrieval_span = trace.retrieval_span
    if retrieval_span is not None:
        strategy_key = f"chunks>{retrieval_span.source_count or 0}"
        retrieval_node = upsert_graph_node(
            db,
            organization_id=trace.organization_id,
            project_id=trace.project_id,
            node_type=NODE_RETRIEVAL_STRATEGY,
            node_key=strategy_key,
            metadata_json={"chunk_count": retrieval_span.source_count, "latency_ms": retrieval_span.retrieval_latency_ms},
            observed_at=observed_at,
        )
        if (trace.latency_ms or 0) >= 1500 or (retrieval_span.retrieval_latency_ms or 0) >= 1200:
            failure_node = upsert_graph_node(
                db,
                organization_id=trace.organization_id,
                project_id=trace.project_id,
                node_type=NODE_FAILURE_MODE,
                node_key="latency_spike",
                metadata_json=None,
                observed_at=observed_at,
            )
            upsert_graph_edge(
                db,
                organization_id=trace.organization_id,
                project_id=trace.project_id,
                source=retrieval_node,
                target=failure_node,
                relationship_type=REL_RETRIEVAL_FAILURE,
            )

    runtime_events = db.scalars(
        select(GuardrailRuntimeEvent).where(GuardrailRuntimeEvent.trace_id == trace.id)
    ).all()
    for event in runtime_events:
        guardrail_node = upsert_graph_node(
            db,
            organization_id=trace.organization_id,
            project_id=trace.project_id,
            node_type=NODE_GUARDRAIL_POLICY,
            node_key=str(event.policy.policy_type if event.policy is not None else "unknown"),
            metadata_json={"action_taken": event.action_taken},
            observed_at=observed_at,
        )
        upsert_graph_edge(
            db,
            organization_id=trace.organization_id,
            project_id=trace.project_id,
            source=prompt_node,
            target=guardrail_node,
            relationship_type=REL_PROMPT_GUARDRAIL,
        )


def _record_incident_nodes(db, incident: Incident, payload: dict) -> None:
    observed_at = _parse_timestamp(str(payload.get("started_at") or incident.started_at.isoformat()))
    incident_node = upsert_graph_node(
        db,
        organization_id=incident.organization_id,
        project_id=incident.project_id,
        node_type=NODE_INCIDENT,
        node_key=str(incident.id),
        metadata_json={"incident_type": incident.incident_type, "severity": incident.severity},
        observed_at=observed_at,
    )
    if incident.deployment_id is not None:
        deployment_node = upsert_graph_node(
            db,
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            node_type=NODE_DEPLOYMENT,
            node_key=str(incident.deployment_id),
            metadata_json=None,
            observed_at=observed_at,
        )
        upsert_graph_edge(
            db,
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            source=deployment_node,
            target=incident_node,
            relationship_type=REL_DEPLOYMENT_INCIDENT,
        )

    trace_ids = [UUID(value) for value in (incident.summary_json or {}).get("sample_trace_ids", [])[:5] if value]
    if not trace_ids:
        return
    traces = db.scalars(select(Trace).where(Trace.id.in_(trace_ids))).all()
    for trace in traces:
        model_key = trace.model_name
        model_node = upsert_graph_node(
            db,
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            node_type=NODE_MODEL_FAMILY,
            node_key=model_key,
            metadata_json={"provider": trace.model_provider},
            observed_at=observed_at,
        )
        upsert_graph_edge(
            db,
            organization_id=incident.organization_id,
            project_id=incident.project_id,
            source=model_node,
            target=incident_node,
            relationship_type=REL_MODEL_INCIDENT,
        )


def process_reliability_graph_event(payload: dict, *, event_type: str) -> None:
    db = SessionLocal()
    try:
        if event_type in {TRACE_INGESTED_EVENT, TRACE_EVALUATED_EVENT, REGRESSION_DETECTED_EVENT}:
            trace = db.get(Trace, UUID(str(payload["trace_id"])))
            if trace is None:
                return
            _record_trace_nodes(db, trace, payload)
        elif event_type == INCIDENT_CREATED_EVENT:
            incident = db.get(Incident, UUID(str(payload["incident_id"])))
            if incident is None:
                return
            _record_incident_nodes(db, incident, payload)
        db.commit()
    finally:
        db.close()


class ReliabilityGraphProcessor(BaseProcessor):
    name = "reliability_graph"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type not in {
            TRACE_INGESTED_EVENT,
            TRACE_EVALUATED_EVENT,
            REGRESSION_DETECTED_EVENT,
            INCIDENT_CREATED_EVENT,
        }:
            return
        process_reliability_graph_event(event.payload, event_type=event.event_type)
