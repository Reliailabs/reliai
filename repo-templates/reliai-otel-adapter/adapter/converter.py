import os
from datetime import datetime, timezone
from typing import Any, Iterable

import httpx

RELIAI_API_URL = os.getenv("RELIAI_API_URL", "http://localhost:8000").rstrip("/")
RELIAI_API_KEY = os.getenv("RELIAI_API_KEY")


def _nanos_to_datetime(nanos: int | str | None) -> datetime:
    if nanos is None:
        return datetime.now(timezone.utc)
    try:
        value = int(nanos)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(value / 1_000_000_000, tz=timezone.utc)


def _duration_ms(start_ns: int | str | None, end_ns: int | str | None) -> int | None:
    try:
        start_val = int(start_ns)
        end_val = int(end_ns)
    except (TypeError, ValueError):
        return None
    if end_val < start_val:
        return None
    return int((end_val - start_val) / 1_000_000)


def _otel_value(value: dict[str, Any]) -> Any:
    if "stringValue" in value:
        return value["stringValue"]
    if "intValue" in value:
        return value["intValue"]
    if "doubleValue" in value:
        return value["doubleValue"]
    if "boolValue" in value:
        return value["boolValue"]
    if "arrayValue" in value:
        return [_otel_value(item) for item in value.get("arrayValue", {}).get("values", [])]
    return value


def resource_attrs(resource_span: dict[str, Any]) -> dict[str, Any]:
    resource = resource_span.get("resource") or {}
    attrs = {}
    for item in resource.get("attributes", []) or []:
        key = item.get("key")
        value = item.get("value", {})
        if not key:
            continue
        attrs[key] = _otel_value(value)
    return attrs


def span_attrs(span: dict[str, Any]) -> dict[str, Any]:
    attrs: dict[str, Any] = {}
    for item in span.get("attributes", []) or []:
        key = item.get("key")
        value = item.get("value", {})
        if not key:
            continue
        attrs[key] = _otel_value(value)
    return attrs


def status_info(span: dict[str, Any]) -> tuple[bool, str | None]:
    status = span.get("status") or {}
    code = status.get("code")
    message = status.get("message")
    success = code != 2
    return success, message


def build_payload(span: dict[str, Any], resource: dict[str, Any]) -> dict[str, Any]:
    trace_id = span.get("traceId") or span.get("trace_id")
    span_id = span.get("spanId") or span.get("span_id")
    parent_span_id = span.get("parentSpanId") or span.get("parent_span_id")
    start_ns = span.get("startTimeUnixNano")
    end_ns = span.get("endTimeUnixNano")

    success, error_message = status_info(span)

    attributes = span_attrs(span)
    model_name = attributes.get("gen_ai.model") or attributes.get("llm.model") or "otel"

    return {
        "timestamp": _nanos_to_datetime(start_ns).isoformat(),
        "request_id": span_id or "otel-span",
        "service_name": resource.get("service.name"),
        "trace_id": trace_id,
        "span_id": span_id,
        "parent_span_id": parent_span_id,
        "span_name": span.get("name"),
        "model_name": str(model_name),
        "model_provider": attributes.get("llm.provider"),
        "latency_ms": _duration_ms(start_ns, end_ns),
        "success": bool(success),
        "error_type": None if success else (error_message or "otel_error"),
        "metadata_json": {
            "otel": {
                "kind": span.get("kind"),
                "attributes": attributes,
            }
        },
    }


def send_traces(spans: Iterable[dict[str, Any]], resource: dict[str, Any]) -> None:
    if not RELIAI_API_KEY:
        raise RuntimeError("RELIAI_API_KEY is required")
    endpoint = f"{RELIAI_API_URL}/api/v1/ingest/traces"
    headers = {"x-api-key": RELIAI_API_KEY, "Content-Type": "application/json"}
    with httpx.Client(timeout=5) as client:
        for span in spans:
            payload = build_payload(span, resource)
            client.post(endpoint, headers=headers, json=payload)
