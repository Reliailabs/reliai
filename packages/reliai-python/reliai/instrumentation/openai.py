from __future__ import annotations

from typing import Any


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
