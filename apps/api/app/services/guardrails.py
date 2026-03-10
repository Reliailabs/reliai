from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guardrail_event import GuardrailEvent
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.project import Project
from app.models.trace import Trace
from app.schemas.guardrail import GuardrailPolicyCreate
from app.services.environments import normalize_environment_name, resolve_project_environment

POLICY_STRUCTURED_OUTPUT = "structured_output"
POLICY_HALLUCINATION = "hallucination"
POLICY_COST_BUDGET = "cost_budget"
POLICY_LATENCY_RETRY = "latency_retry"


@dataclass(frozen=True)
class GuardrailDecision:
    triggered: bool
    action_taken: str | None
    metadata_json: dict | None


def list_guardrail_policies(db: Session, *, project_id, environment: str | None = None) -> list[GuardrailPolicy]:
    statement = select(GuardrailPolicy).where(GuardrailPolicy.project_id == project_id)
    if environment is not None:
        statement = statement.where(GuardrailPolicy.environment_ref.has(name=normalize_environment_name(environment)))
    return db.scalars(
        statement
        .order_by(GuardrailPolicy.created_at.desc(), GuardrailPolicy.id.desc())
    ).all()


def create_guardrail_policy(db: Session, *, project: Project, payload: GuardrailPolicyCreate) -> GuardrailPolicy:
    environment = resolve_project_environment(db, project=project, name=payload.environment)
    policy = GuardrailPolicy(
        project_id=project.id,
        environment_id=environment.id,
        policy_type=payload.policy_type,
        config_json=payload.config_json,
        is_active=payload.is_active,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


def active_guardrail_policies(db: Session, *, project_id, environment: str | None = None) -> list[GuardrailPolicy]:
    statement = select(GuardrailPolicy).where(GuardrailPolicy.project_id == project_id, GuardrailPolicy.is_active.is_(True))
    if environment is not None:
        statement = statement.where(GuardrailPolicy.environment_ref.has(name=normalize_environment_name(environment)))
    return db.scalars(
        statement
        .order_by(GuardrailPolicy.created_at.asc(), GuardrailPolicy.id.asc())
    ).all()


def get_active_guardrail_policies(db: Session, *, project_id, environment: str | None = None) -> list[GuardrailPolicy]:
    return active_guardrail_policies(db, project_id=project_id, environment=environment)


def _is_json_output(value: str | None) -> bool:
    if value is None:
        return False
    try:
        json.loads(value)
        return True
    except (TypeError, json.JSONDecodeError):
        return False


def _to_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def validate_structured_output(*, output_text: str | None, config_json: dict) -> GuardrailDecision:
    if config_json.get("require_json", True) is False:
        return GuardrailDecision(triggered=False, action_taken=None, metadata_json=None)
    if _is_json_output(output_text):
        return GuardrailDecision(triggered=False, action_taken=None, metadata_json=None)
    return GuardrailDecision(
        triggered=True,
        action_taken=config_json["action"],
        metadata_json={"reason": "invalid_json_output"},
    )


def detect_hallucination(*, trace: Trace, config_json: dict) -> GuardrailDecision:
    metadata = trace.metadata_json or {}
    retrieval = trace.retrieval_span
    reasons: list[str] = []
    if metadata.get("hallucination_detected") is True:
        reasons.append("metadata_flagged_hallucination")
    if metadata.get("grounded") is False:
        reasons.append("metadata_grounded_false")
    if config_json.get("require_retrieval") and (retrieval is None or (retrieval.source_count or 0) <= 0):
        reasons.append("missing_retrieval_support")
    if not reasons:
        return GuardrailDecision(triggered=False, action_taken=None, metadata_json=None)
    return GuardrailDecision(
        triggered=True,
        action_taken=config_json["action"],
        metadata_json={"reasons": reasons},
    )


def enforce_cost_budget(*, total_cost_usd: Decimal | None, config_json: dict) -> GuardrailDecision:
    max_cost = _to_decimal(config_json.get("max_cost_usd"))
    if max_cost is None or total_cost_usd is None or total_cost_usd <= max_cost:
        return GuardrailDecision(triggered=False, action_taken=None, metadata_json=None)
    return GuardrailDecision(
        triggered=True,
        action_taken=config_json["action"],
        metadata_json={"max_cost_usd": str(max_cost), "observed_cost_usd": str(total_cost_usd)},
    )


def latency_retry_policy(*, latency_ms: int | None, config_json: dict) -> GuardrailDecision:
    max_latency_ms = config_json.get("max_latency_ms")
    if latency_ms is None or max_latency_ms is None or latency_ms <= int(max_latency_ms):
        return GuardrailDecision(triggered=False, action_taken=None, metadata_json=None)
    metadata_json = {
        "max_latency_ms": int(max_latency_ms),
        "observed_latency_ms": latency_ms,
    }
    if config_json.get("fallback_model") is not None:
        metadata_json["fallback_model"] = config_json["fallback_model"]
    return GuardrailDecision(
        triggered=True,
        action_taken=config_json["action"],
        metadata_json=metadata_json,
    )


def evaluate_trace_guardrails(db: Session, *, project: Project, trace: Trace) -> list[GuardrailEvent]:
    events: list[GuardrailEvent] = []
    for policy in active_guardrail_policies(db, project_id=project.id, environment=trace.environment):
        if policy.policy_type == POLICY_STRUCTURED_OUTPUT:
            decision = validate_structured_output(output_text=trace.output_text, config_json=policy.config_json)
        elif policy.policy_type == POLICY_HALLUCINATION:
            decision = detect_hallucination(trace=trace, config_json=policy.config_json)
        elif policy.policy_type == POLICY_COST_BUDGET:
            decision = enforce_cost_budget(total_cost_usd=trace.total_cost_usd, config_json=policy.config_json)
        else:
            decision = latency_retry_policy(latency_ms=trace.latency_ms, config_json=policy.config_json)

        if not decision.triggered or decision.action_taken is None:
            continue

        event = GuardrailEvent(
            trace_id=trace.id,
            policy_id=policy.id,
            action_taken=decision.action_taken,
            metadata_json=decision.metadata_json,
        )
        db.add(event)
        db.flush()
        events.append(event)
    return events


def record_runtime_guardrail_event(
    db: Session,
    *,
    project_id,
    trace_id,
    policy_id,
    action_taken: str,
    provider_model: str | None,
    latency_ms: int | None,
    metadata_json: dict | None,
) -> GuardrailRuntimeEvent:
    policy = db.get(GuardrailPolicy, policy_id)
    if policy is None or policy.project_id != project_id:
        raise ValueError("Guardrail policy does not belong to project")
    event = GuardrailRuntimeEvent(
        trace_id=trace_id,
        environment_id=policy.environment_id,
        policy_id=policy_id,
        action_taken=action_taken,
        provider_model=provider_model,
        latency_ms=latency_ms,
        metadata_json=metadata_json,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
