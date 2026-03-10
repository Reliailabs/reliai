from __future__ import annotations

from pydantic import ValidationError

from app.events.trace_event_schema import SUPPORTED_TRACE_EVENT_VERSIONS


def validate_trace_event(event: dict) -> dict:
    event_version = event.get("event_version")
    if event_version not in SUPPORTED_TRACE_EVENT_VERSIONS:
        raise ValueError(f"unsupported trace event version: {event_version}")

    model = SUPPORTED_TRACE_EVENT_VERSIONS[event_version]
    try:
        validated = model.model_validate(event)
    except ValidationError as exc:
        raise ValueError("invalid trace event payload") from exc
    payload = validated.model_dump(mode="json")
    if isinstance(payload.get("timestamp"), str) and payload["timestamp"].endswith("+00:00"):
        payload["timestamp"] = payload["timestamp"].replace("+00:00", "Z")
    return payload
