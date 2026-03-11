from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.processor_failure import ProcessorFailure
from app.models.trace import Trace
from app.services.event_processing_metrics import get_event_pipeline_status
from app.services.trace_ingestion_control import get_effective_ingestion_policy


def get_support_debug_snapshot(db: Session, *, project_id: UUID) -> dict:
    policy = get_effective_ingestion_policy(db, project_id=project_id)
    pipeline = get_event_pipeline_status(db)
    failures = db.execute(
        select(ProcessorFailure,).where(ProcessorFailure.project_id == project_id).order_by(ProcessorFailure.created_at.desc()).limit(10)
    ).scalars().all()
    traces = db.scalars(
        select(Trace)
        .where(Trace.project_id == project_id)
        .order_by(Trace.created_at.desc())
        .limit(10)
    ).all()
    guardrails = db.execute(
        select(
            GuardrailPolicy.policy_type,
            GuardrailRuntimeEvent.action_taken,
            GuardrailRuntimeEvent.created_at,
            GuardrailPolicy.environment_id,
        )
        .join(GuardrailRuntimeEvent, GuardrailRuntimeEvent.policy_id == GuardrailPolicy.id)
        .where(GuardrailPolicy.project_id == project_id)
        .order_by(GuardrailRuntimeEvent.created_at.desc())
        .limit(10)
    ).all()
    return {
        "project_id": str(project_id),
        "ingestion_policy": {
            "sampling_success_rate": policy.sampling_success_rate,
            "sampling_error_rate": policy.sampling_error_rate,
            "retention_days_success": policy.retention_days_success,
            "retention_days_error": policy.retention_days_error,
        },
        "pipeline": [
            {
                "consumer_name": item.consumer_name,
                "health": item.health,
                "lag": item.lag,
                "error_count_recent": item.error_count_recent,
                "last_processed_at": item.last_processed_at.isoformat() if item.last_processed_at is not None else None,
            }
            for item in pipeline.consumers
        ],
        "processor_failures": [
            {
                "processor_name": item.external_processor.name if item.external_processor is not None else "unknown",
                "event_type": item.event_type,
                "last_error": item.last_error,
                "created_at": item.created_at.isoformat(),
            }
            for item in failures
        ],
        "trace_samples": [
            {
                "trace_id": str(item.id),
                "environment": item.environment,
                "created_at": item.created_at.isoformat(),
                "success": item.success,
                "latency_ms": item.latency_ms,
            }
            for item in traces
        ],
        "guardrail_triggers": [
            {
                "policy_type": policy_type,
                "action_taken": action_taken,
                "created_at": created_at.isoformat(),
                "environment": str(environment) if environment is not None else None,
            }
            for policy_type, action_taken, created_at, environment in guardrails
        ],
    }
