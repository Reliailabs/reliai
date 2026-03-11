from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.trace import Trace

SENSITIVE_KEY_FRAGMENTS = (
    "api_key",
    "secret",
    "token",
    "authorization",
    "password",
    "access_key",
    "credential",
)

SENSITIVE_VALUE_PATTERNS = (
    re.compile(r"bearer\s+[a-z0-9._-]+", re.IGNORECASE),
    re.compile(r"sk-[a-z0-9]+", re.IGNORECASE),
)


def _span_type(trace: Trace) -> str:
    metadata = trace.metadata_json or {}
    value = metadata.get("span_type")
    if isinstance(value, str) and value.strip():
        normalized = value.strip().lower()
        if normalized == "prompt_build":
            return "prompt_build"
        return normalized
    if trace.guardrail_policy:
        return "guardrail"
    if trace.span_name:
        normalized = trace.span_name.strip().lower()
        if normalized in {"retrieval", "prompt_build", "llm_call", "tool_call", "postprocess"}:
            return normalized
    return "request"


def _sanitize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: ("[REDACTED]" if any(fragment in key.lower() for fragment in SENSITIVE_KEY_FRAGMENTS) else _sanitize_value(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    if isinstance(value, str):
        sanitized = value
        for pattern in SENSITIVE_VALUE_PATTERNS:
            sanitized = pattern.sub("[REDACTED]", sanitized)
        return sanitized
    return value


def _replay_step(trace: Trace) -> dict[str, Any]:
    metadata = _sanitize_value(trace.metadata_json or {})
    step_type = _span_type(trace)
    model_parameters = metadata.get("model_parameters") if isinstance(metadata.get("model_parameters"), dict) else None
    prompt_variables = metadata.get("prompt_variables") if isinstance(metadata.get("prompt_variables"), dict) else None
    tool_inputs = metadata.get("tool_inputs") if isinstance(metadata.get("tool_inputs"), dict) else None

    step: dict[str, Any] = {
        "span_id": trace.span_id,
        "parent_span_id": trace.parent_span_id,
        "span_name": trace.span_name,
        "span_type": step_type,
        "inputs": None,
        "template": None,
        "variables": None,
        "model": None,
        "parameters": None,
        "prompt": None,
        "tool_name": None,
        "guardrail_policy": trace.guardrail_policy,
        "guardrail_action": trace.guardrail_action,
    }

    if step_type == "retrieval":
        retrieval = getattr(trace, "retrieval_span", None)
        step["inputs"] = {
            "query": retrieval.query_text if retrieval is not None else trace.input_text,
            "top_k": retrieval.top_k if retrieval is not None else None,
            "source_count": retrieval.source_count if retrieval is not None else None,
            "vector_db": metadata.get("vector_db"),
        }
    elif step_type == "prompt_build":
        step["template"] = metadata.get("prompt_template") if isinstance(metadata.get("prompt_template"), str) else None
        step["variables"] = prompt_variables
        step["inputs"] = {
            "prompt_version": trace.prompt_version,
            "input": trace.input_text,
        }
    elif step_type == "llm_call":
        step["model"] = trace.model_name
        step["parameters"] = model_parameters or {
            key: metadata.get(key)
            for key in ("temperature", "top_p", "max_tokens")
            if metadata.get(key) is not None
        } or None
        step["prompt"] = trace.input_text
    elif step_type == "tool_call":
        step["tool_name"] = metadata.get("tool_name") if isinstance(metadata.get("tool_name"), str) else trace.span_name
        step["inputs"] = tool_inputs or {"input": trace.input_text}
    elif step_type == "postprocess":
        step["inputs"] = {
            "input": trace.input_text,
            "output": trace.output_text,
        }
    elif step_type == "guardrail":
        step["inputs"] = {
            "policy": trace.guardrail_policy,
            "action": trace.guardrail_action,
            "input": trace.input_text,
            "output": trace.output_text,
        }
    else:
        step["inputs"] = {
            "input": trace.input_text,
            "output": trace.output_text,
        }

    return step


def get_trace_replay(db: Session, trace_id: str) -> dict[str, Any]:
    traces = db.scalars(
        select(Trace)
        .where(Trace.trace_id == trace_id)
        .options(selectinload(Trace.retrieval_span))
        .order_by(Trace.timestamp.asc(), Trace.created_at.asc(), Trace.id.asc())
    ).all()
    if not traces:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace replay not found")

    root = traces[0]
    return {
        "trace_id": trace_id,
        "organization_id": root.organization_id,
        "project_id": root.project_id,
        "environment": root.environment,
        "steps": [_replay_step(trace) for trace in traces],
    }
