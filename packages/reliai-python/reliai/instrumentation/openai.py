from __future__ import annotations

import time
from inspect import iscoroutinefunction
from typing import Any

from ..client import ReliaiClient


def is_openai_request(url: str) -> bool:
    return "api.openai.com" in url.lower()


def build_openai_trace(request_json: dict[str, Any], response_json: dict[str, Any], latency_ms: int, ok: bool) -> dict[str, Any] | None:
    model = request_json.get("model")
    if not isinstance(model, str):
        return None
    messages = request_json.get("messages")
    prompt_lines: list[str] = []
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = message.get("role", "message")
            content = _coerce_content(message.get("content"))
            if content:
                prompt_lines.append(f"{role}: {content}")
    choices = response_json.get("choices")
    output = None
    if isinstance(choices, list) and choices:
        choice = choices[0]
        if isinstance(choice, dict):
            message = choice.get("message")
            if isinstance(message, dict):
                output = _coerce_content(message.get("content")) or None
            elif isinstance(choice.get("text"), str):
                output = choice["text"]
    usage = response_json.get("usage") if isinstance(response_json, dict) else None
    return {
        "model": model,
        "provider": "openai",
        "input_text": "\n".join(prompt_lines) or None,
        "output_text": output,
        "latency_ms": latency_ms,
        "prompt_tokens": usage.get("prompt_tokens") if isinstance(usage, dict) else None,
        "completion_tokens": usage.get("completion_tokens") if isinstance(usage, dict) else None,
        "success": ok,
        "metadata": {"auto_instrumented": True, "span_type": "llm"},
    }


def _coerce_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        fragments: list[str] = []
        for item in content:
            if isinstance(item, str):
                fragments.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                fragments.append(item["text"])
        return "\n".join(fragment for fragment in fragments if fragment)
    return ""


def instrument_openai(client: ReliaiClient) -> bool:
    try:
        import openai  # type: ignore
    except Exception:
        return False

    patched = False
    chat_completion = getattr(openai, "ChatCompletion", None)
    if chat_completion is not None and _patch_callable(chat_completion, "create", client, "chat_completion"):
        patched = True

    responses = getattr(openai, "responses", None)
    if responses is not None and _patch_callable(responses, "create", client, "responses"):
        patched = True

    async_chat_completion = getattr(openai, "AsyncChatCompletion", None)
    if async_chat_completion is not None and _patch_callable(async_chat_completion, "create", client, "chat_completion"):
        patched = True

    async_responses = getattr(openai, "AsyncResponses", None)
    if async_responses is not None and _patch_callable(async_responses, "create", client, "responses"):
        patched = True

    return patched


def _patch_callable(owner: Any, method_name: str, client: ReliaiClient, operation: str) -> bool:
    original = getattr(owner, method_name, None)
    if not callable(original) or getattr(original, "__reliai_patched__", False):
        return False

    if iscoroutinefunction(original):

        async def wrapped(*args: Any, **kwargs: Any):
            started_at = time.perf_counter()
            with client.span("openai.request", {"framework": "openai", "auto_instrumented": True, "openai.operation": operation}) as span:
                try:
                    response = await original(*args, **kwargs)
                except Exception as exc:
                    span.set_metadata({"openai.operation": operation, "openai.error_type": type(exc).__name__})
                    raise
                _record_openai_span(span, operation, kwargs, response, int((time.perf_counter() - started_at) * 1000))
                return response

    else:

        def wrapped(*args: Any, **kwargs: Any):
            started_at = time.perf_counter()
            with client.span("openai.request", {"framework": "openai", "auto_instrumented": True, "openai.operation": operation}) as span:
                try:
                    response = original(*args, **kwargs)
                except Exception as exc:
                    span.set_metadata({"openai.operation": operation, "openai.error_type": type(exc).__name__})
                    raise
                _record_openai_span(span, operation, kwargs, response, int((time.perf_counter() - started_at) * 1000))
                return response

    setattr(wrapped, "__reliai_patched__", True)
    setattr(owner, method_name, wrapped)
    return True


def _record_openai_span(span: Any, operation: str, request_kwargs: dict[str, Any], response: Any, latency_ms: int) -> None:
    response_payload = _response_to_dict(response)
    usage = _usage_from_payload(response_payload)
    model = request_kwargs.get("model") or response_payload.get("model")
    span.set_trace_fields(
        model=model or "openai",
        provider="openai",
        latency_ms=latency_ms,
        prompt_tokens=usage.get("prompt_tokens"),
        completion_tokens=usage.get("completion_tokens"),
        input_text=_input_text_from_request(operation, request_kwargs),
        output_text=_output_text_from_response(operation, response_payload),
    )
    span.set_metadata(
        {
            "framework": "openai",
            "auto_instrumented": True,
            "openai.operation": operation,
            "openai.model": model,
            "openai.usage": usage,
        }
    )


def _response_to_dict(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    for method_name in ("model_dump", "to_dict"):
        method = getattr(response, method_name, None)
        if callable(method):
            try:
                data = method()
                if isinstance(data, dict):
                    return data
            except Exception:
                continue
    if hasattr(response, "__dict__"):
        return dict(response.__dict__)
    return {}


def _usage_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    usage = payload.get("usage")
    if isinstance(usage, dict):
        return {
            "prompt_tokens": usage.get("prompt_tokens") or usage.get("input_tokens"),
            "completion_tokens": usage.get("completion_tokens") or usage.get("output_tokens"),
        }
    return {"prompt_tokens": None, "completion_tokens": None}


def _input_text_from_request(operation: str, request_kwargs: dict[str, Any]) -> str | None:
    if operation == "responses":
        content = request_kwargs.get("input")
        if isinstance(content, str):
            return content
    messages = request_kwargs.get("messages")
    if isinstance(messages, list):
        lines: list[str] = []
        for message in messages:
            if isinstance(message, dict):
                role = message.get("role", "message")
                text = _coerce_content(message.get("content"))
                if text:
                    lines.append(f"{role}: {text}")
        if lines:
            return "\n".join(lines)
    return None


def _output_text_from_response(operation: str, payload: dict[str, Any]) -> str | None:
    if operation == "responses":
        output_text = payload.get("output_text")
        if isinstance(output_text, str):
            return output_text
        output = payload.get("output")
        if isinstance(output, list):
            fragments: list[str] = []
            for item in output:
                if isinstance(item, dict):
                    for content in item.get("content", []):
                        if isinstance(content, dict) and isinstance(content.get("text"), str):
                            fragments.append(content["text"])
            if fragments:
                return "\n".join(fragments)
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0]
        if isinstance(choice, dict):
            message = choice.get("message")
            if isinstance(message, dict):
                return _coerce_content(message.get("content")) or None
            if isinstance(choice.get("text"), str):
                return choice["text"]
    return None
