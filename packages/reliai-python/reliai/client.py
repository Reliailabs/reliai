from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.request
import uuid
from collections.abc import Callable
from contextvars import ContextVar, Token
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from typing import Any

from .defaults import resolve_runtime_config
from .guardrails import ReliaiGuardrailEvent
from .tracing import ReliaiRetrievalSpan, ReliaiTraceEvent

_SPAN_CONTEXT: ContextVar[dict[str, Any] | None] = ContextVar("reliai_span_context", default=None)


class ReliaiClient:
    def __init__(
        self,
        project: str | None = None,
        api_key: str | None = None,
        endpoint: str | None = None,
        environment: str | None = None,
        organization_id: str | None = None,
        local_project_id: str | None = None,
        mode: str | None = None,
        console_fallback: bool = False,
        batch_size: int = 50,
        flush_interval: float = 2.0,
        on_error: Callable[[Exception], None] | None = None,
    ) -> None:
        self.project = project or os.getenv("RELIAI_PROJECT", "default")
        self.api_key = api_key or os.getenv("RELIAI_API_KEY", "")
        self.endpoint = (endpoint or os.getenv("RELIAI_ENDPOINT", "https://api.reliai.ai")).rstrip("/")
        self.environment = environment or os.getenv("RELIAI_ENVIRONMENT")
        self.organization_id = organization_id or os.getenv("RELIAI_ORGANIZATION_ID")
        self.local_project_id = local_project_id
        self.mode = mode or ("cloud" if self.api_key else "development")
        self.console_fallback = console_fallback
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.on_error = on_error
        self._queue: list[tuple[str, Any]] = []
        self._lock = threading.Lock()
        self._wake_event = threading.Event()
        self._closed = False
        self._policy_cache: list[dict[str, Any]] = []
        self._policy_cache_at = 0.0
        self._worker = threading.Thread(target=self._run, name="reliai-flush", daemon=True)
        self._worker.start()

    def trace(self, event: ReliaiTraceEvent | dict[str, Any]) -> None:
        self._enqueue("trace", event)

    def guardrail_event(self, event: ReliaiGuardrailEvent | dict[str, Any]) -> None:
        self._enqueue("guardrail", event)

    def span(self, name: str, metadata: dict[str, Any] | None = None) -> "ReliaiSpan":
        return ReliaiSpan(self, name=name, metadata=metadata or {})

    def flush(self) -> None:
        while True:
            with self._lock:
                batch = self._queue[: self.batch_size]
                del self._queue[: self.batch_size]
            if not batch:
                return
            self._flush_batch(batch)

    def close(self) -> None:
        self._closed = True
        self._wake_event.set()
        self._worker.join(timeout=5)
        self.flush()

    def request_json(self, path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
        request = urllib.request.Request(
            f"{self.endpoint}{path}",
            data=json.dumps(payload).encode("utf-8") if payload is not None else None,
            headers=_request_headers(self.api_key),
            method=method,
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    def get_org_guardrail_policies(self, *, force_refresh: bool = False) -> list[dict[str, Any]]:
        if not self.organization_id:
            return []
        interval_seconds = int(os.getenv("RELIAI_POLICY_SYNC_INTERVAL", "300"))
        now = time.time()
        if not force_refresh and self._policy_cache and (now - self._policy_cache_at) < interval_seconds:
            return list(self._policy_cache)
        payload = self.request_json(f"/api/v1/organizations/{self.organization_id}/policies")
        items = payload.get("items")
        self._policy_cache = list(items) if isinstance(items, list) else []
        self._policy_cache_at = now
        return list(self._policy_cache)

    def org_guardrail_policy(self, policy_type: str) -> dict[str, Any] | None:
        for policy in self.get_org_guardrail_policies():
            if policy.get("policy_type") == policy_type and policy.get("enabled", True):
                return policy
        return None

    def policy_violation_event(self, payload: dict[str, Any]) -> None:
        self._post("/api/v1/runtime/policy-violations", payload)

    def __enter__(self) -> "ReliaiClient":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def current_span_context(self) -> dict[str, str | None] | None:
        return _SPAN_CONTEXT.get()

    def propagation_headers(self) -> dict[str, str]:
        context = self.current_span_context()
        if not context:
            return {}
        return {
            "x-reliai-trace-id": str(context["trace_id"]),
            "x-reliai-parent-span-id": str(context["span_id"]),
        }

    def annotate_current_span(self, metadata: dict[str, Any]) -> None:
        context = self.current_span_context()
        if not context:
            return
        annotations = context.setdefault("annotations", {})
        if isinstance(annotations, dict):
            annotations.update(metadata)

    def _enqueue(self, kind: str, event: Any) -> None:
        with self._lock:
            self._queue.append((kind, event))
            size = len(self._queue)
        if size >= self.batch_size:
            self._wake_event.set()

    def _run(self) -> None:
        while not self._closed:
            self._wake_event.wait(self.flush_interval)
            self._wake_event.clear()
            try:
                self.flush()
            except Exception as exc:  # pragma: no cover - defensive background path
                if self.on_error:
                    self.on_error(exc)

    def _flush_batch(self, batch: list[tuple[str, Any]]) -> None:
        for kind, event in batch:
            try:
                if kind == "trace":
                    self._post("/api/v1/ingest/traces", self._normalize_trace(event))
                else:
                    self._post("/api/v1/runtime/guardrail-events", self._normalize_guardrail_event(event))
            except Exception as exc:
                if self.on_error:
                    self.on_error(exc)

    def _normalize_trace(self, event: ReliaiTraceEvent | dict[str, Any]) -> dict[str, Any]:
        payload = _coerce_dict(event)
        retrieval = payload.get("retrieval")
        if isinstance(retrieval, ReliaiRetrievalSpan):
            retrieval = asdict(retrieval)
        normalized: dict[str, Any] = {
            "timestamp": _coerce_timestamp(payload.get("timestamp")),
            "request_id": payload.get("request_id") or payload.get("span_id") or str(uuid.uuid4()),
            "environment": payload.get("environment") or self.environment,
            "user_id": payload.get("user_id"),
            "session_id": payload.get("session_id"),
            "model_name": payload["model"],
            "model_provider": payload.get("provider"),
            "prompt_version": payload.get("prompt_version"),
            "input_text": payload.get("input_text"),
            "output_text": payload.get("output_text"),
            "latency_ms": payload.get("latency_ms") or payload.get("duration_ms"),
            "prompt_tokens": payload.get("prompt_tokens"),
            "completion_tokens": payload.get("completion_tokens"),
            "total_cost_usd": payload.get("total_cost_usd"),
            "success": payload.get("success", True),
            "error_type": payload.get("error_type"),
            "metadata_json": _merge_metadata(payload),
        }
        if normalized["metadata_json"] is None:
            normalized["metadata_json"] = {}
        normalized["metadata_json"].update(
            {
                "configured_project": self.project,
                "reliai_mode": self.mode,
            }
        )
        if self.local_project_id:
            normalized["metadata_json"]["local_project_id"] = self.local_project_id
        if retrieval:
            normalized["retrieval"] = {
                "retrieval_latency_ms": retrieval.get("retrieval_latency_ms"),
                "source_count": retrieval.get("source_count"),
                "top_k": retrieval.get("top_k"),
                "query_text": retrieval.get("query_text"),
                "retrieved_chunks_json": retrieval.get("retrieved_chunks"),
            }
        return normalized

    def _normalize_guardrail_event(self, event: ReliaiGuardrailEvent | dict[str, Any]) -> dict[str, Any]:
        payload = _coerce_dict(event)
        metadata = dict(payload.get("metadata") or {})
        if payload.get("policy"):
            metadata["policy"] = payload["policy"]
        return {
            "trace_id": payload["trace_id"],
            "policy_id": payload["policy_id"],
            "environment": payload.get("environment") or self.environment,
            "action_taken": payload["action"],
            "provider_model": payload.get("provider_model"),
            "latency_ms": payload.get("latency_ms"),
            "metadata_json": metadata or None,
        }

    def _post(self, path: str, payload: dict[str, Any]) -> None:
        try:
            self.request_json(path, method="POST", payload=payload)
        except Exception as exc:
            if self.mode == "development":
                self._console_log(path, payload, exc)
                return
            raise

    def _console_log(self, path: str, payload: dict[str, Any], exc: Exception | None = None) -> None:
        fallback_payload = {
            "mode": self.mode,
            "endpoint": self.endpoint,
            "path": path,
            "project": self.project,
            "environment": self.environment,
            "error": str(exc) if exc else None,
            "payload": payload,
        }
        print(f"RELIAI {json.dumps(fallback_payload, sort_keys=True)}", file=sys.stderr)


class ReliaiSpan:
    def __init__(self, client: ReliaiClient, name: str, metadata: dict[str, Any]) -> None:
        self.client = client
        self.name = name
        self.metadata = dict(metadata)
        self.trace_fields: dict[str, Any] = {}
        self.started_at: datetime | None = None
        self.trace_id: str | None = None
        self.span_id: str | None = None
        self.parent_span_id: str | None = None
        self._token: Token[dict[str, Any] | None] | None = None

    def __enter__(self) -> "ReliaiSpan":
        parent = self.client.current_span_context()
        self.trace_id = str(parent["trace_id"]) if parent else str(uuid.uuid4())
        self.parent_span_id = str(parent["span_id"]) if parent and parent.get("span_id") else None
        self.span_id = str(uuid.uuid4())
        self.started_at = datetime.now(timezone.utc)
        self._token = _SPAN_CONTEXT.set(
            {
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "parent_span_id": self.parent_span_id,
                "annotations": {},
            }
        )
        return self

    def __exit__(self, exc_type: object, exc: object, _tb: object) -> None:
        context = self.client.current_span_context() or {}
        if self._token is not None:
            _SPAN_CONTEXT.reset(self._token)
        if self.started_at is None or self.trace_id is None or self.span_id is None:
            return
        duration_ms = int((datetime.now(timezone.utc) - self.started_at).total_seconds() * 1000)
        self.client.trace(
            {
                "model": self.trace_fields.get("model") or "span",
                "provider": self.trace_fields.get("provider") or "reliai",
                "input_text": self.trace_fields.get("input_text"),
                "output_text": self.trace_fields.get("output_text"),
                "latency_ms": self.trace_fields.get("latency_ms") or duration_ms,
                "prompt_tokens": self.trace_fields.get("prompt_tokens"),
                "completion_tokens": self.trace_fields.get("completion_tokens"),
                "total_cost_usd": self.trace_fields.get("total_cost_usd"),
                "success": exc is None,
                "error_type": exc_type.__name__ if exc_type else None,
                "request_id": self.span_id,
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "parent_span_id": self.parent_span_id,
                "span_name": self.name,
                "start_time": self.started_at,
                "timestamp": self.started_at,
                "duration_ms": duration_ms,
                "environment": self.trace_fields.get("environment") or self.client.environment,
                "metadata": {
                    **self.metadata,
                    **context.get("annotations", {}),
                },
                "retrieval": self.trace_fields.get("retrieval"),
            }
        )

    def set_metadata(self, metadata: dict[str, Any]) -> None:
        self.metadata.update(metadata)

    def set_trace_fields(self, **fields: Any) -> None:
        self.trace_fields.update(fields)


_DEFAULT_CLIENT: ReliaiClient | None = None


def initialize_default_client(
    project: str | None = None,
    api_key: str | None = None,
    environment: str | None = None,
) -> ReliaiClient:
    global _DEFAULT_CLIENT
    config = resolve_runtime_config(project=project, api_key=api_key, environment=environment)
    _DEFAULT_CLIENT = ReliaiClient(
        project=config.project,
        api_key=config.api_key,
        endpoint=config.endpoint,
        environment=config.environment,
        organization_id=config.organization_id,
        local_project_id=config.local_project_id,
        mode=config.mode,
        console_fallback=config.console_fallback,
    )
    if config.mode == "development" and config.first_run:
        print("Reliai initialized in development mode.\n\nDashboard:\nhttp://localhost:3000", file=sys.stderr)
    return _DEFAULT_CLIENT


def get_default_client() -> ReliaiClient:
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is None:
        _DEFAULT_CLIENT = initialize_default_client()
    return _DEFAULT_CLIENT


def reset_default_client() -> None:
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is not None:
        _DEFAULT_CLIENT.close()
    _DEFAULT_CLIENT = None


def _coerce_dict(value: Any) -> dict[str, Any]:
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, dict):
        return value
    raise TypeError("Expected dataclass or dict payload")


def _coerce_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, str):
        return value
    return datetime.now(timezone.utc).isoformat()


def _merge_metadata(payload: dict[str, Any]) -> dict[str, Any] | None:
    metadata = dict(payload.get("metadata") or {})
    if payload.get("trace_id"):
        metadata.update(
            {
                "reliai_trace_id": payload.get("trace_id"),
                "reliai_span_id": payload.get("span_id"),
                "reliai_parent_span_id": payload.get("parent_span_id"),
                "span_name": payload.get("span_name"),
                "span_start_time": _coerce_timestamp(payload.get("start_time") or payload.get("timestamp")),
                "span_duration_ms": payload.get("duration_ms") or payload.get("latency_ms"),
            }
        )
    return metadata or None


def _request_headers(api_key: str | None) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key
    return headers
