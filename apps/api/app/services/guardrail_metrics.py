from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.trace import Trace


def get_guardrail_policy_metrics(db: Session, project_id: UUID) -> list[dict]:
    policies = db.scalars(
        select(GuardrailPolicy)
        .where(GuardrailPolicy.project_id == project_id)
        .order_by(GuardrailPolicy.created_at.asc(), GuardrailPolicy.id.asc())
    ).all()

    aggregates = db.execute(
        select(
            GuardrailRuntimeEvent.policy_id.label("policy_id"),
            func.count(GuardrailRuntimeEvent.id).label("trigger_count"),
            func.max(GuardrailRuntimeEvent.created_at).label("last_triggered_at"),
        )
        .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
        .where(GuardrailPolicy.project_id == project_id)
        .group_by(GuardrailRuntimeEvent.policy_id)
    ).all()
    aggregate_by_policy = {row.policy_id: row for row in aggregates}

    items = []
    for policy in policies:
        aggregate = aggregate_by_policy.get(policy.id)
        items.append(
            {
                "policy_id": policy.id,
                "policy_type": policy.policy_type,
                "action": policy.config_json.get("action", "unknown"),
                "trigger_count": int(aggregate.trigger_count) if aggregate is not None else 0,
                "last_triggered_at": aggregate.last_triggered_at if aggregate is not None else None,
                "created_at": policy.created_at,
            }
        )
    items.sort(
        key=lambda item: (
            item["trigger_count"],
            item["last_triggered_at"] or item["created_at"],
            str(item["policy_id"]),
        ),
        reverse=True,
    )
    for item in items:
        item.pop("created_at", None)
    return items


def get_recent_guardrail_events(db: Session, project_id: UUID, limit: int = 20) -> list[dict]:
    events = db.execute(
        select(
            GuardrailRuntimeEvent.trace_id,
            GuardrailRuntimeEvent.action_taken,
            GuardrailRuntimeEvent.provider_model,
            GuardrailRuntimeEvent.latency_ms,
            GuardrailRuntimeEvent.created_at,
            GuardrailPolicy.policy_type,
        )
        .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
        .where(GuardrailPolicy.project_id == project_id)
        .order_by(desc(GuardrailRuntimeEvent.created_at), desc(GuardrailRuntimeEvent.id))
        .limit(limit)
    ).all()

    trace_ids = [row.trace_id for row in events]
    existing_trace_ids = set()
    if trace_ids:
        existing_trace_ids = set(
            db.scalars(select(Trace.id).where(Trace.project_id == project_id, Trace.id.in_(trace_ids))).all()
        )

    return [
        {
            "policy_type": row.policy_type,
            "action_taken": row.action_taken,
            "provider_model": row.provider_model,
            "latency_ms": row.latency_ms,
            "created_at": row.created_at,
            "trace_id": row.trace_id,
            "trace_available": row.trace_id in existing_trace_ids,
        }
        for row in events
    ]
