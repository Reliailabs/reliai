from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any, Callable, Literal

GuardrailAction = Literal["block", "retry", "fallback_model", "log_only"]
EnforcementMode = Literal["observe", "warn", "enforce", "block"]


@dataclass(slots=True)
class ReliaiGuardrailEvent:
    trace_id: str
    policy_id: str
    action: GuardrailAction
    policy: str | None = None
    environment: str | None = None
    provider_model: str | None = None
    latency_ms: int | None = None
    metadata: dict[str, Any] | None = None


def make_policy_id(policy: str, config: dict[str, Any]) -> str:
    digest = hashlib.sha1(f"{policy}:{json.dumps(config, sort_keys=True, default=str)}".encode("utf-8")).hexdigest()
    return f"{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}"


def _coerce_mapping(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _validate_schema(schema: dict[str, Any] | Callable[[Any], bool], value: Any) -> bool:
    if callable(schema):
        return bool(schema(value))
    candidate = _coerce_mapping(value)
    if candidate is None:
        return False
    for key, expected in schema.items():
        if key not in candidate:
            return False
        if isinstance(expected, dict) and not _validate_schema(expected, candidate[key]):
            return False
    return True


def _emit_guardrail(
    client: Any,
    *,
    policy: str,
    config: dict[str, Any],
    action: GuardrailAction,
    trace_id: str | None = None,
    span_id: str | None = None,
    environment: str | None = None,
    provider_model: str | None = None,
    latency_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    active = client.current_span_context() if hasattr(client, "current_span_context") else None
    resolved_trace_id = trace_id or (str(active["trace_id"]) if active else make_policy_id("trace", {"policy": policy}))
    resolved_span_id = span_id or (str(active["span_id"]) if active else None)
    if hasattr(client, "annotate_current_span"):
        client.annotate_current_span({"guardrail_policy": policy, "guardrail_action": action})
    client.guardrail_event(
        ReliaiGuardrailEvent(
            trace_id=resolved_trace_id,
            policy_id=make_policy_id(policy, config),
            policy=policy,
            environment=environment,
            provider_model=provider_model,
            latency_ms=latency_ms,
            action=action,
            metadata={
                "span_id": resolved_span_id,
                **(metadata or {}),
            }
            or None,
        )
    )


def _policy_mode(policy: dict[str, Any] | None) -> EnforcementMode:
    value = str((policy or {}).get("enforcement_mode") or "enforce")
    if value in {"observe", "warn", "enforce", "block"}:
        return value  # type: ignore[return-value]
    return "enforce"


def _policy_config(
    client: Any,
    *,
    policy_type: str,
    explicit: dict[str, Any],
) -> tuple[dict[str, Any], EnforcementMode]:
    policy = client.org_guardrail_policy(policy_type) if hasattr(client, "org_guardrail_policy") else None
    config = dict((policy or {}).get("config_json") or {})
    for key, value in explicit.items():
        if value is not None:
            config[key] = value
    return config, _policy_mode(policy)


def _emit_policy_violation(
    client: Any,
    *,
    policy_type: str,
    enforcement_mode: EnforcementMode,
    action_taken: str,
    trace_id: str | None,
    provider_model: str | None,
    latency_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not hasattr(client, "policy_violation_event"):
        return
    active = client.current_span_context() if hasattr(client, "current_span_context") else None
    resolved_trace_id = trace_id or (str(active["trace_id"]) if active else make_policy_id("trace", {"policy": policy_type}))
    client.policy_violation_event(
        {
            "trace_id": resolved_trace_id,
            "policy_type": policy_type,
            "enforcement_mode": enforcement_mode,
            "action_taken": action_taken,
            "provider_model": provider_model,
            "latency_ms": latency_ms,
            "metadata_json": metadata or None,
        }
    )


def structured_output(
    schema: dict[str, Any] | Callable[[Any], bool],
    fn: Callable[[], Any],
    *,
    client: Any,
    retry_limit: int | None = None,
    trace_id: str | None = None,
    span_id: str | None = None,
    environment: str | None = None,
    provider_model: str | None = None,
) -> Any:
    config, mode = _policy_config(
        client,
        policy_type="structured_output",
        explicit={
            "schema": schema,
            "retry_limit": retry_limit,
        },
    )
    retries = int(config.get("retry_limit") or os.getenv("RELIAI_GUARDRAIL_RETRY_LIMIT", "1"))
    attempts = 0
    while True:
        result = fn()
        if _validate_schema(schema, result):
            return result
        if mode in {"observe", "warn"}:
            _emit_policy_violation(
                client,
                policy_type="structured_output",
                enforcement_mode=mode,
                action_taken=mode,
                trace_id=trace_id,
                provider_model=provider_model,
                metadata={"attempt": attempts + 1, "reason": "invalid_structured_output"},
            )
            return result
        _emit_guardrail(
            client,
            policy="structured_output",
            config={"schema": schema, "retry_limit": retries, "enforcement_mode": mode},
            action="retry",
            trace_id=trace_id,
            span_id=span_id,
            environment=environment,
            provider_model=provider_model,
            metadata={"attempt": attempts + 1, "reason": "invalid_structured_output"},
        )
        if attempts >= retries:
            if mode == "block":
                _emit_policy_violation(
                    client,
                    policy_type="structured_output",
                    enforcement_mode=mode,
                    action_taken="block_response",
                    trace_id=trace_id,
                    provider_model=provider_model,
                    metadata={"attempt": attempts + 1, "reason": "invalid_structured_output"},
                )
                raise RuntimeError("Reliai structured output policy blocked response")
            return result
        _emit_policy_violation(
            client,
            policy_type="structured_output",
            enforcement_mode=mode,
            action_taken="retry",
            trace_id=trace_id,
            provider_model=provider_model,
            metadata={"attempt": attempts + 1, "reason": "invalid_structured_output"},
        )
        attempts += 1


def latency_retry(
    fn: Callable[[], Any],
    *,
    client: Any,
    max_latency_ms: int,
    retry_limit: int | None = None,
    trace_id: str | None = None,
    span_id: str | None = None,
    environment: str | None = None,
    provider_model: str | None = None,
) -> Any:
    import time

    config, mode = _policy_config(
        client,
        policy_type="latency_retry",
        explicit={
            "max_latency_ms": max_latency_ms,
            "retry_limit": retry_limit,
        },
    )
    retries = int(config.get("retry_limit") or os.getenv("RELIAI_GUARDRAIL_RETRY_LIMIT", "1"))
    threshold = int(config.get("max_latency_ms") or max_latency_ms)
    attempts = 0
    while True:
        started = time.time()
        result = fn()
        latency_ms = int((time.time() - started) * 1000)
        if latency_ms <= threshold:
            return result
        if mode in {"observe", "warn"}:
            _emit_policy_violation(
                client,
                policy_type="latency_retry",
                enforcement_mode=mode,
                action_taken=mode,
                trace_id=trace_id,
                provider_model=provider_model,
                latency_ms=latency_ms,
                metadata={"attempt": attempts + 1, "reason": "latency_threshold_exceeded"},
            )
            return result
        if attempts >= retries:
            if mode == "block":
                _emit_policy_violation(
                    client,
                    policy_type="latency_retry",
                    enforcement_mode=mode,
                    action_taken="block_response",
                    trace_id=trace_id,
                    provider_model=provider_model,
                    latency_ms=latency_ms,
                    metadata={"attempt": attempts + 1, "reason": "latency_threshold_exceeded"},
                )
                raise RuntimeError("Reliai latency policy blocked response")
            return result
        _emit_guardrail(
            client,
            policy="latency_retry",
            config={"max_latency_ms": threshold, "retry_limit": retries, "enforcement_mode": mode},
            action="retry",
            trace_id=trace_id,
            span_id=span_id,
            environment=environment,
            provider_model=provider_model,
            latency_ms=latency_ms,
            metadata={"attempt": attempts + 1, "reason": "latency_threshold_exceeded"},
        )
        _emit_policy_violation(
            client,
            policy_type="latency_retry",
            enforcement_mode=mode,
            action_taken="retry",
            trace_id=trace_id,
            provider_model=provider_model,
            latency_ms=latency_ms,
            metadata={"attempt": attempts + 1, "reason": "latency_threshold_exceeded"},
        )
        attempts += 1


def cost_budget(
    fn: Callable[[], Any],
    *,
    client: Any,
    max_tokens: int | None = None,
    max_cost_usd: float | None = None,
    trace_id: str | None = None,
    span_id: str | None = None,
    environment: str | None = None,
    provider_model: str | None = None,
) -> Any:
    config, mode = _policy_config(
        client,
        policy_type="cost_budget",
        explicit={
            "max_tokens": max_tokens,
            "max_cost_usd": max_cost_usd,
        },
    )
    result = fn()
    candidate = result if isinstance(result, dict) else {}
    prompt_tokens = int(candidate.get("prompt_tokens") or candidate.get("promptTokens") or 0)
    completion_tokens = int(candidate.get("completion_tokens") or candidate.get("completionTokens") or 0)
    total_cost_usd = float(candidate.get("total_cost_usd") or candidate.get("totalCostUsd") or 0)
    total_tokens = prompt_tokens + completion_tokens
    token_limit = int(config["max_tokens"]) if config.get("max_tokens") is not None else None
    cost_limit = float(config["max_cost_usd"]) if config.get("max_cost_usd") is not None else None
    over_tokens = token_limit is not None and total_tokens > token_limit
    over_cost = cost_limit is not None and total_cost_usd > cost_limit
    if not over_tokens and not over_cost:
        return result
    _emit_policy_violation(
        client,
        policy_type="cost_budget",
        enforcement_mode=mode,
        action_taken=mode if mode in {"observe", "warn"} else "raise",
        trace_id=trace_id,
        provider_model=provider_model,
        metadata={
            "reason": "cost_budget_exceeded",
            "observed_tokens": total_tokens,
            "observed_cost_usd": total_cost_usd,
            "max_tokens": token_limit,
            "max_cost_usd": cost_limit,
        },
    )
    if mode in {"observe", "warn"}:
        return result
    _emit_guardrail(
        client,
        policy="cost_budget",
        config={"max_tokens": token_limit, "max_cost_usd": cost_limit, "enforcement_mode": mode},
        action="block",
        trace_id=trace_id,
        span_id=span_id,
        environment=environment,
        provider_model=provider_model,
        metadata={
            "reason": "cost_budget_exceeded",
            "observed_tokens": total_tokens,
            "observed_cost_usd": total_cost_usd,
        },
    )
    raise RuntimeError("Reliai cost budget guardrail blocked execution")
