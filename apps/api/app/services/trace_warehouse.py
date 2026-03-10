from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx

from app.core.settings import get_settings
from app.models.trace import Trace

logger = logging.getLogger(__name__)

TRACE_WAREHOUSE_TABLE = "trace_events"
STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _structured_output_valid(trace: Trace) -> bool | None:
    for evaluation in getattr(trace, "evaluations", []):
        if evaluation.eval_type != STRUCTURED_VALIDITY_EVAL_TYPE:
            continue
        if evaluation.label == "pass":
            return True
        if evaluation.label == "fail":
            return False
    return None


@dataclass(frozen=True)
class TraceWarehouseQuery:
    organization_id: UUID
    project_id: UUID
    window_start: datetime
    window_end: datetime
    prompt_version_id: UUID | None = None
    model_version_id: UUID | None = None
    prompt_version: str | None = None
    model_name: str | None = None
    limit: int | None = None


@dataclass(frozen=True)
class TraceWarehouseAggregateQuery:
    organization_id: UUID
    project_id: UUID
    window_start: datetime
    window_end: datetime


@dataclass(frozen=True)
class TraceWarehouseEventRow:
    timestamp: datetime
    organization_id: UUID
    project_id: UUID
    trace_id: UUID
    prompt_version_id: UUID | None
    model_version_id: UUID | None
    latency_ms: int | None
    success: bool
    error_type: str | None
    input_tokens: int | None
    output_tokens: int | None
    cost: Decimal | None
    structured_output_valid: bool | None
    retrieval_latency_ms: int | None
    retrieval_chunks: int | None
    metadata_json: dict[str, Any] | None


class TraceWarehouseClient:
    def ensure_schema(self) -> None:  # pragma: no cover - interface only
        raise NotImplementedError

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:  # pragma: no cover - interface only
        raise NotImplementedError

    def query_trace_events(self, query: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:  # pragma: no cover
        raise NotImplementedError

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError


class NullTraceWarehouseClient(TraceWarehouseClient):
    def ensure_schema(self) -> None:
        return None

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:
        return None

    def query_trace_events(self, query: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
        return []

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
        return {
            "trace_count": 0,
            "success_rate": None,
            "average_latency_ms": None,
            "structured_output_validity_rate": None,
        }


class HttpTraceWarehouseClient(TraceWarehouseClient):
    def __init__(self, *, base_url: str, database: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.database = database
        self._schema_ready = False

    def _post(self, sql: str, *, params: dict[str, Any] | None = None, content: bytes | None = None) -> httpx.Response:
        query_params = {"database": self.database, "query": sql}
        if params:
            for key, value in params.items():
                query_params[f"param_{key}"] = value
        response = httpx.post(
            self.base_url,
            params=query_params,
            content=content,
            timeout=10.0,
        )
        response.raise_for_status()
        return response

    def ensure_schema(self) -> None:
        if self._schema_ready:
            return
        create_sql = f"""
        CREATE TABLE IF NOT EXISTS {TRACE_WAREHOUSE_TABLE}
        (
            timestamp DateTime64(3, 'UTC'),
            organization_id UUID,
            project_id UUID,
            trace_id UUID,
            prompt_version_id Nullable(UUID),
            model_version_id Nullable(UUID),
            latency_ms Nullable(Int32),
            success Bool,
            error_type Nullable(String),
            input_tokens Nullable(Int32),
            output_tokens Nullable(Int32),
            cost Nullable(Float64),
            structured_output_valid Nullable(Bool),
            retrieval_latency_ms Nullable(Int32),
            retrieval_chunks Nullable(Int32),
            metadata_json String
        )
        ENGINE = MergeTree
        PARTITION BY toDate(timestamp)
        PRIMARY KEY (project_id, timestamp)
        ORDER BY (project_id, timestamp, trace_id)
        """
        self._post(create_sql)
        self._schema_ready = True

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:
        if not rows:
            return
        self.ensure_schema()
        payload = b"\n".join(
            json.dumps(
                {
                    "timestamp": _ensure_utc(row.timestamp).isoformat(),
                    "organization_id": str(row.organization_id),
                    "project_id": str(row.project_id),
                    "trace_id": str(row.trace_id),
                    "prompt_version_id": str(row.prompt_version_id) if row.prompt_version_id is not None else None,
                    "model_version_id": str(row.model_version_id) if row.model_version_id is not None else None,
                    "latency_ms": row.latency_ms,
                    "success": row.success,
                    "error_type": row.error_type,
                    "input_tokens": row.input_tokens,
                    "output_tokens": row.output_tokens,
                    "cost": _decimal_to_float(row.cost),
                    "structured_output_valid": row.structured_output_valid,
                    "retrieval_latency_ms": row.retrieval_latency_ms,
                    "retrieval_chunks": row.retrieval_chunks,
                    "metadata_json": json.dumps(row.metadata_json or {}, sort_keys=True, separators=(",", ":")),
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            for row in rows
        )
        self._post(f"INSERT INTO {TRACE_WAREHOUSE_TABLE} FORMAT JSONEachRow", content=payload)

    def query_trace_events(self, query: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
        self.ensure_schema()
        clauses = [
            "organization_id = toUUID({organization_id:String})",
            "project_id = toUUID({project_id:String})",
            "timestamp >= parseDateTime64BestEffort({window_start:String})",
            "timestamp < parseDateTime64BestEffort({window_end:String})",
        ]
        params: dict[str, Any] = {
            "organization_id": str(query.organization_id),
            "project_id": str(query.project_id),
            "window_start": _ensure_utc(query.window_start).isoformat(),
            "window_end": _ensure_utc(query.window_end).isoformat(),
        }
        if query.prompt_version_id is not None:
            clauses.append("prompt_version_id = toUUID({prompt_version_id:String})")
            params["prompt_version_id"] = str(query.prompt_version_id)
        if query.model_version_id is not None:
            clauses.append("model_version_id = toUUID({model_version_id:String})")
            params["model_version_id"] = str(query.model_version_id)
        if query.prompt_version is not None:
            clauses.append("JSONExtractString(metadata_json, '__prompt_version') = {prompt_version:String}")
            params["prompt_version"] = query.prompt_version
        if query.model_name is not None:
            clauses.append("JSONExtractString(metadata_json, '__model_name') = {model_name:String}")
            params["model_name"] = query.model_name

        limit_clause = f" LIMIT {query.limit}" if query.limit is not None else ""
        sql = f"""
        SELECT
            timestamp,
            organization_id,
            project_id,
            trace_id,
            prompt_version_id,
            model_version_id,
            latency_ms,
            success,
            error_type,
            input_tokens,
            output_tokens,
            cost,
            structured_output_valid,
            retrieval_latency_ms,
            retrieval_chunks,
            metadata_json
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE {' AND '.join(clauses)}
        ORDER BY timestamp DESC, trace_id DESC
        {limit_clause}
        FORMAT JSONEachRow
        """
        response = self._post(sql, params=params)
        rows: list[TraceWarehouseEventRow] = []
        for line in response.text.splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            rows.append(
                TraceWarehouseEventRow(
                    timestamp=datetime.fromisoformat(payload["timestamp"]),
                    organization_id=UUID(payload["organization_id"]),
                    project_id=UUID(payload["project_id"]),
                    trace_id=UUID(payload["trace_id"]),
                    prompt_version_id=UUID(payload["prompt_version_id"]) if payload.get("prompt_version_id") else None,
                    model_version_id=UUID(payload["model_version_id"]) if payload.get("model_version_id") else None,
                    latency_ms=payload.get("latency_ms"),
                    success=bool(payload["success"]),
                    error_type=payload.get("error_type"),
                    input_tokens=payload.get("input_tokens"),
                    output_tokens=payload.get("output_tokens"),
                    cost=Decimal(str(payload["cost"])) if payload.get("cost") is not None else None,
                    structured_output_valid=payload.get("structured_output_valid"),
                    retrieval_latency_ms=payload.get("retrieval_latency_ms"),
                    retrieval_chunks=payload.get("retrieval_chunks"),
                    metadata_json=json.loads(payload["metadata_json"]) if payload.get("metadata_json") else {},
                )
            )
        return rows

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
        self.ensure_schema()
        sql = f"""
        SELECT
            count() AS trace_count,
            avg(toFloat64(success)) AS success_rate,
            avg(latency_ms) AS average_latency_ms,
            avg(toFloat64(structured_output_valid)) AS structured_output_validity_rate
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE organization_id = toUUID({{organization_id:String}})
          AND project_id = toUUID({{project_id:String}})
          AND timestamp >= parseDateTime64BestEffort({{window_start:String}})
          AND timestamp < parseDateTime64BestEffort({{window_end:String}})
        FORMAT JSONEachRow
        """
        response = self._post(
            sql,
            params={
                "organization_id": str(query.organization_id),
                "project_id": str(query.project_id),
                "window_start": _ensure_utc(query.window_start).isoformat(),
                "window_end": _ensure_utc(query.window_end).isoformat(),
            },
        )
        line = next((item for item in response.text.splitlines() if item.strip()), "")
        if not line:
            return {
                "trace_count": 0,
                "success_rate": None,
                "average_latency_ms": None,
                "structured_output_validity_rate": None,
            }
        payload = json.loads(line)
        return {
            "trace_count": int(payload.get("trace_count", 0)),
            "success_rate": payload.get("success_rate"),
            "average_latency_ms": payload.get("average_latency_ms"),
            "structured_output_validity_rate": payload.get("structured_output_validity_rate"),
        }


def get_trace_warehouse_client() -> TraceWarehouseClient:
    settings = get_settings()
    if not settings.trace_warehouse_url:
        return NullTraceWarehouseClient()
    return HttpTraceWarehouseClient(
        base_url=settings.trace_warehouse_url,
        database=settings.clickhouse_database,
    )


def trace_warehouse_enabled() -> bool:
    return bool(get_settings().trace_warehouse_url)


def build_trace_event_row(trace: Trace) -> TraceWarehouseEventRow:
    metadata = dict(trace.metadata_json or {})
    metadata.setdefault("__model_name", trace.model_name)
    metadata.setdefault("__model_provider", trace.model_provider)
    metadata.setdefault("__prompt_version", trace.prompt_version)
    metadata.setdefault("request_id", trace.request_id)
    metadata.setdefault("environment", trace.environment)
    return TraceWarehouseEventRow(
        timestamp=trace.timestamp,
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        trace_id=trace.id,
        prompt_version_id=trace.prompt_version_record_id,
        model_version_id=trace.model_version_record_id,
        latency_ms=trace.latency_ms,
        success=trace.success,
        error_type=trace.error_type,
        input_tokens=trace.prompt_tokens,
        output_tokens=trace.completion_tokens,
        cost=trace.total_cost_usd,
        structured_output_valid=_structured_output_valid(trace),
        retrieval_latency_ms=trace.retrieval_span.retrieval_latency_ms if trace.retrieval_span is not None else None,
        retrieval_chunks=trace.retrieval_span.source_count if trace.retrieval_span is not None else None,
        metadata_json=metadata,
    )


def ingest_trace_event(trace: Trace) -> None:
    client = get_trace_warehouse_client()
    try:
        client.insert_trace_events([build_trace_event_row(trace)])
    except Exception:
        logger.exception("failed to ingest trace event into warehouse", extra={"trace_id": str(trace.id)})


def query_traces(filters: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
    return get_trace_warehouse_client().query_trace_events(filters)


def aggregate_trace_metrics(query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
    return get_trace_warehouse_client().aggregate_trace_metrics(query)
