from __future__ import annotations

import json
import os
import time
from typing import Any

from .client import ReliaiClient
from .guardrails import ReliaiGuardrailEvent, make_policy_id
from .instrumentation.anthropic import build_anthropic_trace, is_anthropic_request
from .instrumentation.langchain import detect_langchain, instrument_langchain
from .instrumentation.llamaindex import detect_llamaindex, instrument_llamaindex
from .instrumentation.openai import build_openai_trace, is_openai_request

_AUTO_CLIENT: ReliaiClient | None = None
_PATCHED = False


def enable_auto_instrumentation(client: ReliaiClient | None = None) -> ReliaiClient | None:
    global _AUTO_CLIENT, _PATCHED
    if _PATCHED:
        return _AUTO_CLIENT
    api_key = os.getenv("RELIAI_API_KEY")
    if client is None and not api_key:
        return None
    _AUTO_CLIENT = client or ReliaiClient(api_key=api_key)
    instrument_langchain(_AUTO_CLIENT)
    instrument_llamaindex(_AUTO_CLIENT)
    try:
        import httpx  # type: ignore
    except Exception:
        return _AUTO_CLIENT

    original_request = httpx.Client.request
    original_async_request = httpx.AsyncClient.request

    def request_wrapper(self: Any, method: str, url: str, *args: Any, **kwargs: Any):
        headers = _merge_headers(kwargs.get("headers"), _AUTO_CLIENT.propagation_headers() if _AUTO_CLIENT else {})
        kwargs["headers"] = headers
        with (_AUTO_CLIENT.span("llm_call", {"auto_instrumented": True, "span_type": "llm"}) if _AUTO_CLIENT else _noop_span()) as span:
            response, latency_ms = _guarded_request(original_request, self, method, url, args, kwargs)
            _record_trace(str(url), kwargs, response, latency_ms, span)
            return response

    async def async_request_wrapper(self: Any, method: str, url: str, *args: Any, **kwargs: Any):
        span = _AUTO_CLIENT.span("llm_call", {"auto_instrumented": True, "span_type": "llm"}) if _AUTO_CLIENT else _noop_span()
        headers = _merge_headers(kwargs.get("headers"), _AUTO_CLIENT.propagation_headers() if _AUTO_CLIENT else {})
        kwargs["headers"] = headers
        span.__enter__()
        try:
            response, latency_ms = await _guarded_async_request(original_async_request, self, method, url, args, kwargs)
            _record_trace(str(url), kwargs, response, latency_ms, span)
            span.__exit__(None, None, None)
            return response
        except Exception as exc:
            span.__exit__(type(exc), exc, exc.__traceback__)
            raise

    httpx.Client.request = request_wrapper
    httpx.AsyncClient.request = async_request_wrapper
    _PATCHED = True
    return _AUTO_CLIENT


def _guardrails_enabled() -> bool:
    return os.getenv("RELIAI_GUARDRAILS_ENABLED", "false").lower() == "true"


def _should_require_structured_output(request_json: dict[str, Any] | None) -> bool:
    if not isinstance(request_json, dict):
        return False
    response_format = request_json.get("response_format")
    if isinstance(response_format, dict):
        response_type = response_format.get("type")
        return isinstance(response_type, str) and "json" in response_type
    return False


def _response_has_valid_json(response: Any) -> bool:
    try:
        payload = response.json()
    except Exception:
        return False
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if isinstance(choices, list) and choices:
        choice = choices[0]
        if isinstance(choice, dict):
            message = choice.get("message")
            content = message.get("content") if isinstance(message, dict) else choice.get("text")
            if isinstance(content, str):
                try:
                    json.loads(content)
                    return True
                except Exception:
                    return False
    content = payload.get("content") if isinstance(payload, dict) else None
    if isinstance(content, list):
        text = "\n".join(item["text"] for item in content if isinstance(item, dict) and isinstance(item.get("text"), str))
        if text:
            try:
                json.loads(text)
                return True
            except Exception:
                return False
    return False


def _emit_runtime_guardrail(policy: str, action: str, latency_ms: int | None = None, metadata: dict[str, Any] | None = None) -> None:
    if _AUTO_CLIENT is None:
        return
    context = _AUTO_CLIENT.current_span_context() or {}
    _AUTO_CLIENT.annotate_current_span({"guardrail_policy": policy, "guardrail_action": action})
    _AUTO_CLIENT.guardrail_event(
        ReliaiGuardrailEvent(
            trace_id=str(context.get("trace_id") or make_policy_id("trace", {"policy": policy})),
            policy_id=make_policy_id(policy, metadata or {}),
            policy=policy,
            action=action,  # type: ignore[arg-type]
            latency_ms=latency_ms,
            metadata={"span_id": context.get("span_id"), **(metadata or {})},
        )
    )


def _guarded_request(request_fn: Any, client: Any, method: str, url: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> tuple[Any, int]:
    started_at = time.time()
    response = request_fn(client, method, url, *args, **kwargs)
    latency_ms = int((time.time() - started_at) * 1000)
    if not _guardrails_enabled():
        return response, latency_ms
    request_json = _request_json(kwargs)
    retry_limit = int(os.getenv("RELIAI_GUARDRAIL_RETRY_LIMIT", "1"))
    if latency_ms > int(os.getenv("RELIAI_GUARDRAIL_MAX_LATENCY_MS", "5000")) and retry_limit > 0:
        _emit_runtime_guardrail("latency_retry", "retry", latency_ms, {"reason": "latency_threshold_exceeded"})
        started_at = time.time()
        response = request_fn(client, method, url, *args, **kwargs)
        latency_ms = int((time.time() - started_at) * 1000)
    if _should_require_structured_output(request_json) and not _response_has_valid_json(response) and retry_limit > 0:
        _emit_runtime_guardrail("structured_output", "retry", latency_ms, {"reason": "invalid_structured_output"})
        started_at = time.time()
        response = request_fn(client, method, url, *args, **kwargs)
        latency_ms = int((time.time() - started_at) * 1000)
    return response, latency_ms


async def _guarded_async_request(request_fn: Any, client: Any, method: str, url: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> tuple[Any, int]:
    started_at = time.time()
    response = await request_fn(client, method, url, *args, **kwargs)
    latency_ms = int((time.time() - started_at) * 1000)
    if not _guardrails_enabled():
        return response, latency_ms
    request_json = _request_json(kwargs)
    retry_limit = int(os.getenv("RELIAI_GUARDRAIL_RETRY_LIMIT", "1"))
    if latency_ms > int(os.getenv("RELIAI_GUARDRAIL_MAX_LATENCY_MS", "5000")) and retry_limit > 0:
        _emit_runtime_guardrail("latency_retry", "retry", latency_ms, {"reason": "latency_threshold_exceeded"})
        started_at = time.time()
        response = await request_fn(client, method, url, *args, **kwargs)
        latency_ms = int((time.time() - started_at) * 1000)
    if _should_require_structured_output(request_json) and not _response_has_valid_json(response) and retry_limit > 0:
        _emit_runtime_guardrail("structured_output", "retry", latency_ms, {"reason": "invalid_structured_output"})
        started_at = time.time()
        response = await request_fn(client, method, url, *args, **kwargs)
        latency_ms = int((time.time() - started_at) * 1000)
    return response, latency_ms


def _record_trace(url: str, kwargs: dict[str, Any], response: Any, latency_ms: int, span: Any) -> None:
    if _AUTO_CLIENT is None:
        return
    if not is_openai_request(url) and not is_anthropic_request(url):
        return
    request_json = _request_json(kwargs)
    if request_json is None:
        return
    try:
        response_json = response.json()
    except Exception:
        response_json = {}
    trace = (
        build_openai_trace(request_json, response_json, latency_ms, bool(response.is_success))
        if is_openai_request(url)
        else build_anthropic_trace(request_json, response_json, latency_ms, bool(response.is_success))
    )
    if not trace:
        return
    headers = kwargs.get("headers") or {}
    user_agent = headers.get("user-agent") if isinstance(headers, dict) else None
    framework = None
    if detect_langchain(user_agent):
        framework = "langchain"
    elif detect_llamaindex(user_agent):
        framework = "llamaindex"
    metadata = dict(trace.get("metadata") or {})
    if framework:
        metadata["framework"] = framework
    trace["metadata"] = metadata
    span.set_trace_fields(**trace)
    span.set_metadata(metadata)


def _request_json(kwargs: dict[str, Any]) -> dict[str, Any] | None:
    if isinstance(kwargs.get("json"), dict):
        return kwargs["json"]
    content = kwargs.get("content")
    if isinstance(content, (bytes, bytearray)):
        try:
            return json.loads(content.decode("utf-8"))
        except Exception:
            return None
    if isinstance(content, str):
        try:
            return json.loads(content)
        except Exception:
            return None
    return None


class _noop_span:
    def __enter__(self) -> "_noop_span":
        return self

    def __exit__(self, *_args: Any) -> None:
        return None

    def set_trace_fields(self, **_fields: Any) -> None:
        return None

    def set_metadata(self, _metadata: dict[str, Any]) -> None:
        return None


def _merge_headers(existing: Any, reliai_headers: dict[str, str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    if isinstance(existing, dict):
        headers.update({str(key): str(value) for key, value in existing.items()})
    headers.update(reliai_headers)
    return headers


enable_auto_instrumentation()
