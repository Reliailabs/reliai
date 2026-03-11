from __future__ import annotations

from typing import Any


def is_anthropic_request(url: str) -> bool:
    return "api.anthropic.com" in url.lower()


def build_anthropic_trace(
    request_json: dict[str, Any], response_json: dict[str, Any], latency_ms: int, ok: bool
) -> dict[str, Any] | None:
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
            content = _coerce_blocks(message.get("content"))
            if content:
                prompt_lines.append(f"{role}: {content}")
    usage = response_json.get("usage") if isinstance(response_json, dict) else None
    return {
        "model": model,
        "provider": "anthropic",
        "input_text": "\n".join(prompt_lines) or None,
        "output_text": _coerce_blocks(response_json.get("content")) if isinstance(response_json, dict) else None,
        "latency_ms": latency_ms,
        "prompt_tokens": usage.get("input_tokens") if isinstance(usage, dict) else None,
        "completion_tokens": usage.get("output_tokens") if isinstance(usage, dict) else None,
        "success": ok,
        "metadata": {"auto_instrumented": True, "span_type": "llm"},
    }


def _coerce_blocks(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "\n".join(
        block["text"] for block in content if isinstance(block, dict) and isinstance(block.get("text"), str)
    )
