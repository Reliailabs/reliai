from __future__ import annotations

import json
from functools import wraps
from inspect import iscoroutinefunction
from inspect import signature
from typing import Any, Callable, TypeVar, cast

from .client import ReliaiClient, get_default_client, initialize_default_client
from .guardrails import (
    GuardrailAction,
    ReliaiGuardrailEvent,
    cost_budget,
    latency_retry,
    structured_output,
)
from .pipeline import llm_call, postprocess, prompt_build, retrieval, tool_call
from .replay import ReliaiReplayPipeline, replay
from .tracing import ReliaiRetrievalSpan, ReliaiTraceEvent

__version__ = "0.1.0"
F = TypeVar("F", bound=Callable[..., Any])
_MAX_CAPTURE_BYTES = 1024


def init(
    project: str | None = None,
    api_key: str | None = None,
    environment: str | None = None,
) -> ReliaiClient:
    return initialize_default_client(project=project, api_key=api_key, environment=environment)


def span(name: str, metadata: dict | None = None):
    return get_default_client().span(name, metadata)


def trace(
    fn: F | str | None = None,
    *,
    name: str | None = None,
    metadata: dict | None = None,
):
    explicit_name = fn if isinstance(fn, str) else name

    def decorator(inner: F) -> F:
        resolved_name = explicit_name or f"{inner.__module__}.{inner.__qualname__}"
        base_metadata = dict(metadata or {})
        inner_signature = signature(inner)

        if iscoroutinefunction(inner):

            @wraps(inner)
            async def async_wrapper(*args: Any, **kwargs: Any):
                span_metadata = _build_call_metadata(inner, inner_signature, args, kwargs, base_metadata)
                with get_default_client().span(resolved_name, span_metadata) as active_span:
                    try:
                        result = await inner(*args, **kwargs)
                    except Exception as exc:
                        active_span.set_metadata(_exception_metadata(exc))
                        raise
                    _set_return_metadata(active_span, result)
                    return result

            return cast(F, async_wrapper)

        @wraps(inner)
        def wrapper(*args: Any, **kwargs: Any):
            span_metadata = _build_call_metadata(inner, inner_signature, args, kwargs, base_metadata)
            with get_default_client().span(resolved_name, span_metadata) as active_span:
                try:
                    result = inner(*args, **kwargs)
                except Exception as exc:
                    active_span.set_metadata(_exception_metadata(exc))
                    raise
                _set_return_metadata(active_span, result)
                return result

        return cast(F, wrapper)

    if callable(fn) and not isinstance(fn, str):
        return decorator(fn)
    return decorator


def _build_call_metadata(
    fn: Callable[..., Any],
    fn_signature: Any,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    base_metadata: dict[str, Any],
) -> dict[str, Any]:
    captured_arguments: dict[str, Any] = {}
    try:
        bound_arguments = fn_signature.bind_partial(*args, **kwargs)
        for key, value in bound_arguments.arguments.items():
            captured = _capture_value(value)
            if captured is not None:
                captured_arguments[key] = captured
    except Exception:
        pass

    span_metadata = dict(base_metadata)
    span_metadata["function.module"] = fn.__module__
    span_metadata["function.name"] = fn.__qualname__
    if captured_arguments:
        span_metadata["function.args"] = captured_arguments
    return span_metadata


def _set_return_metadata(active_span: Any, result: Any) -> None:
    captured = _capture_value(result)
    if captured is not None:
        active_span.set_metadata({"function.return_value": captured})


def _exception_metadata(exc: Exception) -> dict[str, str]:
    return {
        "function.exception_type": type(exc).__name__,
        "function.exception_message": str(exc),
    }


def _capture_value(value: Any) -> Any | None:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value if _within_size_limit(value) else None
    if isinstance(value, dict):
        shallow: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                continue
            if isinstance(item, (str, int, float, bool)) or item is None:
                shallow[key] = item
        if shallow and _within_size_limit(shallow):
            return shallow
    return None


def _within_size_limit(value: Any) -> bool:
    try:
        return len(json.dumps(value, sort_keys=True).encode("utf-8")) < _MAX_CAPTURE_BYTES
    except (TypeError, ValueError):
        return False

__all__ = [
    "GuardrailAction",
    "ReliaiClient",
    "ReliaiGuardrailEvent",
    "ReliaiRetrievalSpan",
    "ReliaiReplayPipeline",
    "ReliaiTraceEvent",
    "cost_budget",
    "latency_retry",
    "llm_call",
    "postprocess",
    "prompt_build",
    "replay",
    "retrieval",
    "init",
    "span",
    "structured_output",
    "trace",
    "tool_call",
    "__version__",
]
