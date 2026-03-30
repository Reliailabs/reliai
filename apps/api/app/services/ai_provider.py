from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import HTTPException, status


def call_openai_compatible(
    *,
    base_url: str,
    api_key: str | None,
    model: str | None,
    messages: list[dict[str, str]],
    use_json_mode: bool,
    max_tokens: int = 800,
) -> dict[str, Any]:
    if not api_key or not model:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI provider is not configured")
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    if use_json_mode:
        payload["response_format"] = {"type": "json_object"}
    try:
        response = httpx.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc


def call_anthropic(
    *,
    base_url: str,
    api_key: str | None,
    model: str | None,
    system_prompt: str,
    user_prompt: str,
    version: str,
    max_tokens: int = 800,
) -> dict[str, Any]:
    if not api_key or not model:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI provider is not configured")
    endpoint = f"{base_url.rstrip('/')}/v1/messages"
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        response = httpx.post(
            endpoint,
            headers={
                "x-api-key": api_key,
                "anthropic-version": version,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc


def extract_openai_content(data: dict[str, Any]) -> str | None:
    return (data.get("choices") or [{}])[0].get("message", {}).get("content")


def extract_anthropic_content(data: dict[str, Any]) -> str | None:
    content = data.get("content")
    if isinstance(content, list):
        parts = [item.get("text") for item in content if isinstance(item, dict) and item.get("type") == "text"]
        return "".join(part for part in parts if part)
    if isinstance(content, str):
        return content
    return None


def parse_json_content(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI response returned invalid JSON",
        ) from exc
