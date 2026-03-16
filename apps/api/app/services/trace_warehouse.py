"""
INTERNAL SERVICE

The warehouse must only be accessed via trace_query_router.

Direct access bypasses rollup safety guarantees.
"""

from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import hashlib
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.events import build_trace_event_payload, validate_trace_event
from app.core.settings import get_settings
from app.models.trace import Trace
from app.services.clickhouse_migrations import apply_migrations

logger = logging.getLogger(__name__)

TRACE_WAREHOUSE_TABLE = "trace_warehouse"
TRACE_METRICS_HOURLY_TABLE = "trace_metrics_hourly"
TRACE_METRICS_DAILY_TABLE = "trace_metrics_daily"
STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"
MAX_EVENT_WINDOW = timedelta(hours=24)
contextvar_router_active: ContextVar[bool] = ContextVar("trace_warehouse_router_active", default=False)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _prompt_hash(prompt_version_id: str | None, metadata: dict[str, Any] | None) -> str | None:
    prompt_value = prompt_version_id or str((metadata or {}).get("__prompt_version") or "").strip()
    if not prompt_value:
        return None
    return hashlib.sha256(prompt_value.encode("utf-8")).hexdigest()[:24]


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
    environment_id: UUID | None = None
    prompt_version_id: UUID | None = None
    model_version_id: UUID | None = None
    prompt_version: str | None = None
    model_name: str | None = None
    latency_min_ms: int | None = None
    latency_max_ms: int | None = None
    success: bool | None = None
    structured_output_valid: bool | None = None
    limit: int | None = None


@dataclass(frozen=True)
class TraceWarehouseAggregateQuery:
    organization_id: UUID
    project_id: UUID
    window_start: datetime
    window_end: datetime
    environment_id: UUID | None = None
    prompt_version_id: UUID | None = None
    model_version_id: UUID | None = None
    prompt_version: str | None = None
    model_name: str | None = None
    latency_min_ms: int | None = None
    latency_max_ms: int | None = None
    success: bool | None = None
    structured_output_valid: bool | None = None


@dataclass(frozen=True)
class TraceWarehouseRollupRow:
    time_bucket: datetime
    project_id: UUID | None
    environment_id: UUID | None
    model_family: str | None
    trace_count: int
    success_rate: float | None
    latency_avg: float | None
    token_count: int
    cost_usd: float


@dataclass(frozen=True)
class TraceWarehouseEventRow:
    timestamp: datetime
    organization_id: UUID
    project_id: UUID
    environment_id: UUID | None
    storage_trace_id: UUID
    trace_id: str | None
    success: bool
    service_name: str | None = None
    span_id: str | None = None
    parent_span_id: str | None = None
    span_name: str | None = None
    deployment_id: UUID | None = None
    event_version: int = 1
    model_provider: str | None = None
    model_family: str | None = None
    model_revision: str | None = None
    prompt_version_id: str | None = None
    prompt_hash: str | None = None
    model_version_id: UUID | None = None
    latency_ms: int | None = None
    error_type: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: Decimal | None = None
    structured_output_valid: bool | None = None
    guardrail_policy: str | None = None
    guardrail_action: str | None = None
    guardrail_triggered: bool = False
    retrieval_latency_ms: int | None = None
    retrieval_chunks: int | None = None
    incident_flag: bool = False
    metadata_json: dict[str, Any] | None = None

    @property
    def cost(self) -> Decimal | None:
        return self.cost_usd


class TraceWarehouseClient:
    def ensure_schema(self) -> None:  # pragma: no cover - interface only
        raise NotImplementedError

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:  # pragma: no cover - interface only
        raise NotImplementedError

    def query_trace_events(self, query: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:  # pragma: no cover
        raise NotImplementedError

    def query_all_trace_events(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
        limit: int | None = None,
    ) -> list[TraceWarehouseEventRow]:  # pragma: no cover
        raise NotImplementedError

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError

    def count_distinct_services(
        self,
        *,
        organization_id: UUID,
        project_id: UUID,
        environment_id: UUID | None,
        window_start: datetime,
        window_end: datetime,
    ) -> int:  # pragma: no cover
        raise NotImplementedError

    def query_hourly_metrics(
        self,
        *,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:  # pragma: no cover
        raise NotImplementedError

    def query_daily_metrics(
        self,
        *,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:  # pragma: no cover
        raise NotImplementedError

    def get_warehouse_stats(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
    ) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError


class NullTraceWarehouseClient(TraceWarehouseClient):
    def ensure_schema(self) -> None:
        return None

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:
        return None

    def query_trace_events(self, query: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
        return []

    def query_all_trace_events(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
        limit: int | None = None,
    ) -> list[TraceWarehouseEventRow]:
        return []

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
        return {
            "trace_count": 0,
            "success_rate": None,
            "error_rate": None,
            "average_latency_ms": None,
            "structured_output_validity_rate": None,
            "average_cost_usd": None,
        }

    def count_distinct_services(
        self,
        *,
        organization_id: UUID,
        project_id: UUID,
        environment_id: UUID | None,
        window_start: datetime,
        window_end: datetime,
    ) -> int:
        del organization_id, project_id, environment_id, window_start, window_end
        return 0

    def query_hourly_metrics(
        self,
        *,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:
        del project_id, environment_id, start_time, end_time
        return []

    def query_daily_metrics(
        self,
        *,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:
        del project_id, environment_id, start_time, end_time
        return []

    def get_warehouse_stats(self, *, window_start: datetime, window_end: datetime) -> dict[str, Any]:
        return {
            "warehouse_rows": 0,
            "active_partitions": 0,
            "scan_rate": 0.0,
            "avg_query_latency": 0.0,
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
        apply_migrations()
        self._schema_ready = True

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:
        if not rows:
            return
        self.ensure_schema()
        payload = b"\n".join(
            json.dumps(
                {
                    "event_version": row.event_version,
                    "timestamp": _ensure_utc(row.timestamp).isoformat(),
                    "organization_id": str(row.organization_id),
                    "project_id": str(row.project_id),
                    "environment_id": str(row.environment_id) if row.environment_id is not None else None,
                    "service_name": row.service_name,
                    "storage_trace_id": str(row.storage_trace_id),
                    "trace_id": row.trace_id,
                    "span_id": row.span_id,
                    "parent_span_id": row.parent_span_id,
                    "span_name": row.span_name,
                    "deployment_id": str(row.deployment_id) if row.deployment_id is not None else None,
                    "model_provider": row.model_provider,
                    "model_family": row.model_family,
                    "model_revision": row.model_revision,
                    "prompt_version_id": row.prompt_version_id,
                    "prompt_hash": row.prompt_hash,
                    "model_version_id": str(row.model_version_id) if row.model_version_id is not None else None,
                    "latency_ms": row.latency_ms,
                    "success": row.success,
                    "error_type": row.error_type,
                    "input_tokens": row.input_tokens,
                    "output_tokens": row.output_tokens,
                    "cost_usd": _decimal_to_float(row.cost_usd),
                    "structured_output_valid": row.structured_output_valid,
                    "guardrail_policy": row.guardrail_policy,
                    "guardrail_action": row.guardrail_action,
                    "guardrail_triggered": row.guardrail_triggered,
                    "retrieval_latency_ms": row.retrieval_latency_ms,
                    "retrieval_chunks": row.retrieval_chunks,
                    "incident_flag": row.incident_flag,
                    "metadata_json": json.dumps(row.metadata_json or {}, sort_keys=True, separators=(",", ":")),
                    "retention_days": int((row.metadata_json or {}).get("retention_days", 30)),
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
        if query.environment_id is not None:
            clauses.append("environment_id = toUUID({environment_id:String})")
            params["environment_id"] = str(query.environment_id)
        if query.prompt_version_id is not None:
            clauses.append("prompt_version_id = {prompt_version_id:String}")
            params["prompt_version_id"] = str(query.prompt_version_id)
        if query.model_version_id is not None:
            clauses.append("model_version_id = toUUID({model_version_id:String})")
            params["model_version_id"] = str(query.model_version_id)
        if query.prompt_version is not None:
            clauses.append("JSONExtractString(metadata_json, '__prompt_version') = {prompt_version:String}")
            params["prompt_version"] = query.prompt_version
        if query.model_name is not None:
            clauses.append(
                "(model_family = {model_name:String} OR JSONExtractString(metadata_json, '__model_name') = {model_name:String})"
            )
            params["model_name"] = query.model_name
        if query.latency_min_ms is not None:
            clauses.append("latency_ms >= {latency_min_ms:Int32}")
            params["latency_min_ms"] = query.latency_min_ms
        if query.latency_max_ms is not None:
            clauses.append("latency_ms <= {latency_max_ms:Int32}")
            params["latency_max_ms"] = query.latency_max_ms
        if query.success is not None:
            clauses.append("success = {success:Bool}")
            params["success"] = query.success
        if query.structured_output_valid is not None:
            clauses.append("structured_output_valid = {structured_output_valid:Bool}")
            params["structured_output_valid"] = query.structured_output_valid

        limit_clause = f" LIMIT {query.limit}" if query.limit is not None else ""
        sql = f"""
        SELECT
            event_version,
            timestamp,
            organization_id,
            project_id,
            environment_id,
            service_name,
            storage_trace_id,
            trace_id,
            span_id,
            parent_span_id,
            span_name,
            deployment_id,
            model_provider,
            model_family,
            model_revision,
            prompt_version_id,
            prompt_hash,
            model_version_id,
            latency_ms,
            success,
            error_type,
            input_tokens,
            output_tokens,
            cost_usd,
            structured_output_valid,
            guardrail_policy,
            guardrail_action,
            guardrail_triggered,
            retrieval_latency_ms,
            retrieval_chunks,
            incident_flag,
            metadata_json
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE {' AND '.join(clauses)}
        ORDER BY timestamp DESC, storage_trace_id DESC
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
                    event_version=int(payload.get("event_version", 1)),
                    timestamp=datetime.fromisoformat(payload["timestamp"]),
                    organization_id=UUID(payload["organization_id"]),
                    project_id=UUID(payload["project_id"]),
                    environment_id=UUID(payload["environment_id"]) if payload.get("environment_id") else None,
                    service_name=payload.get("service_name"),
                    storage_trace_id=UUID(payload["storage_trace_id"]),
                    trace_id=payload.get("trace_id"),
                    span_id=payload.get("span_id"),
                    parent_span_id=payload.get("parent_span_id"),
                    span_name=payload.get("span_name"),
                    deployment_id=UUID(payload["deployment_id"]) if payload.get("deployment_id") else None,
                    model_provider=payload.get("model_provider"),
                    model_family=payload.get("model_family"),
                    model_revision=payload.get("model_revision"),
                    prompt_version_id=payload.get("prompt_version_id"),
                    prompt_hash=payload.get("prompt_hash"),
                    model_version_id=UUID(payload["model_version_id"]) if payload.get("model_version_id") else None,
                    latency_ms=payload.get("latency_ms"),
                    success=bool(payload["success"]),
                    error_type=payload.get("error_type"),
                    input_tokens=payload.get("input_tokens"),
                    output_tokens=payload.get("output_tokens"),
                    cost_usd=Decimal(str(payload["cost_usd"])) if payload.get("cost_usd") is not None else None,
                    structured_output_valid=payload.get("structured_output_valid"),
                    guardrail_policy=payload.get("guardrail_policy"),
                    guardrail_action=payload.get("guardrail_action"),
                    guardrail_triggered=bool(payload.get("guardrail_triggered", False)),
                    retrieval_latency_ms=payload.get("retrieval_latency_ms"),
                    retrieval_chunks=payload.get("retrieval_chunks"),
                    incident_flag=bool(payload.get("incident_flag", False)),
                    metadata_json=json.loads(payload["metadata_json"]) if payload.get("metadata_json") else {},
                )
            )
        return rows

    def _query_rollups(
        self,
        *,
        table_name: str,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:
        self.ensure_schema()
        bucket_cast = "toDateTime(time_bucket, 'UTC')" if table_name == TRACE_METRICS_DAILY_TABLE else "time_bucket"
        clauses = [
            f"{bucket_cast} >= parseDateTime64BestEffort({{start_time:String}})",
            f"{bucket_cast} < parseDateTime64BestEffort({{end_time:String}})",
        ]
        params: dict[str, Any] = {
            "start_time": _ensure_utc(start_time).isoformat(),
            "end_time": _ensure_utc(end_time).isoformat(),
        }
        if project_id is not None:
            clauses.append("project_id = toUUID({project_id:String})")
            params["project_id"] = str(project_id)
        if environment_id is not None:
            clauses.append("environment_id = toUUID({environment_id:String})")
            params["environment_id"] = str(environment_id)
        sql = f"""
        SELECT
            {bucket_cast} AS time_bucket,
            project_id,
            environment_id,
            model_family,
            trace_count,
            success_rate,
            latency_avg,
            token_count,
            cost_usd
        FROM {table_name}
        WHERE {' AND '.join(clauses)}
        ORDER BY time_bucket ASC, project_id ASC
        FORMAT JSONEachRow
        """
        response = self._post(sql, params=params)
        rows: list[TraceWarehouseRollupRow] = []
        for line in response.text.splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            rows.append(
                TraceWarehouseRollupRow(
                    time_bucket=_ensure_utc(datetime.fromisoformat(payload["time_bucket"])),
                    project_id=UUID(payload["project_id"]) if payload.get("project_id") else None,
                    environment_id=UUID(payload["environment_id"]) if payload.get("environment_id") else None,
                    model_family=payload.get("model_family"),
                    trace_count=int(payload.get("trace_count", 0)),
                    success_rate=payload.get("success_rate"),
                    latency_avg=payload.get("latency_avg"),
                    token_count=int(payload.get("token_count", 0)),
                    cost_usd=float(payload.get("cost_usd", 0.0) or 0.0),
                )
            )
        return rows

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
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
        if query.environment_id is not None:
            clauses.append("environment_id = toUUID({environment_id:String})")
            params["environment_id"] = str(query.environment_id)
        if query.prompt_version_id is not None:
            clauses.append("prompt_version_id = {prompt_version_id:String}")
            params["prompt_version_id"] = str(query.prompt_version_id)
        if query.model_version_id is not None:
            clauses.append("model_version_id = toUUID({model_version_id:String})")
            params["model_version_id"] = str(query.model_version_id)
        if query.prompt_version is not None:
            clauses.append("JSONExtractString(metadata_json, '__prompt_version') = {prompt_version:String}")
            params["prompt_version"] = query.prompt_version
        if query.model_name is not None:
            clauses.append(
                "(model_family = {model_name:String} OR JSONExtractString(metadata_json, '__model_name') = {model_name:String})"
            )
            params["model_name"] = query.model_name
        if query.latency_min_ms is not None:
            clauses.append("latency_ms >= {latency_min_ms:Int32}")
            params["latency_min_ms"] = query.latency_min_ms
        if query.latency_max_ms is not None:
            clauses.append("latency_ms <= {latency_max_ms:Int32}")
            params["latency_max_ms"] = query.latency_max_ms
        if query.success is not None:
            clauses.append("success = {success:Bool}")
            params["success"] = query.success
        if query.structured_output_valid is not None:
            clauses.append("structured_output_valid = {structured_output_valid:Bool}")
            params["structured_output_valid"] = query.structured_output_valid
        sql = f"""
        SELECT
            count() AS trace_count,
            avg(toFloat64(success)) AS success_rate,
            1 - avg(toFloat64(success)) AS error_rate,
            avg(latency_ms) AS average_latency_ms,
            avg(toFloat64(structured_output_valid)) AS structured_output_validity_rate,
            avg(cost_usd) AS average_cost_usd
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE {' AND '.join(clauses)}
        FORMAT JSONEachRow
        """
        response = self._post(sql, params=params)
        line = next((item for item in response.text.splitlines() if item.strip()), "")
        if not line:
            return {
                "trace_count": 0,
                "success_rate": None,
                "error_rate": None,
                "average_latency_ms": None,
                "structured_output_validity_rate": None,
                "average_cost_usd": None,
            }
        payload = json.loads(line)
        return {
            "trace_count": int(payload.get("trace_count", 0)),
            "success_rate": payload.get("success_rate"),
            "error_rate": payload.get("error_rate"),
            "average_latency_ms": payload.get("average_latency_ms"),
            "structured_output_validity_rate": payload.get("structured_output_validity_rate"),
            "average_cost_usd": payload.get("average_cost_usd"),
        }

    def count_distinct_services(
        self,
        *,
        organization_id: UUID,
        project_id: UUID,
        environment_id: UUID | None,
        window_start: datetime,
        window_end: datetime,
    ) -> int:
        self.ensure_schema()
        clauses = [
            "organization_id = toUUID({organization_id:String})",
            "project_id = toUUID({project_id:String})",
            "timestamp >= parseDateTime64BestEffort({window_start:String})",
            "timestamp < parseDateTime64BestEffort({window_end:String})",
            "service_name IS NOT NULL",
            "service_name != ''",
        ]
        params: dict[str, Any] = {
            "organization_id": str(organization_id),
            "project_id": str(project_id),
            "window_start": _ensure_utc(window_start).isoformat(),
            "window_end": _ensure_utc(window_end).isoformat(),
        }
        if environment_id is not None:
            clauses.append("environment_id = toUUID({environment_id:String})")
            params["environment_id"] = str(environment_id)
        sql = f"""
        SELECT uniqExact(service_name) AS active_services
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE {' AND '.join(clauses)}
        FORMAT JSONEachRow
        """
        response = self._post(sql, params=params)
        line = next((item for item in response.text.splitlines() if item.strip()), "")
        if not line:
            return 0
        payload = json.loads(line)
        return int(payload.get("active_services", 0) or 0)

    def query_hourly_metrics(
        self,
        *,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:
        return self._query_rollups(
            table_name=TRACE_METRICS_HOURLY_TABLE,
            project_id=project_id,
            environment_id=environment_id,
            start_time=start_time,
            end_time=end_time,
        )

    def query_daily_metrics(
        self,
        *,
        project_id: UUID | None,
        environment_id: UUID | None,
        start_time: datetime,
        end_time: datetime,
    ) -> list[TraceWarehouseRollupRow]:
        return self._query_rollups(
            table_name=TRACE_METRICS_DAILY_TABLE,
            project_id=project_id,
            environment_id=environment_id,
            start_time=start_time,
            end_time=end_time,
        )

    def query_all_trace_events(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
        limit: int | None = None,
    ) -> list[TraceWarehouseEventRow]:
        self.ensure_schema()
        params: dict[str, Any] = {
            "window_start": _ensure_utc(window_start).isoformat(),
            "window_end": _ensure_utc(window_end).isoformat(),
        }
        limit_clause = f" LIMIT {limit}" if limit is not None else ""
        sql = f"""
        SELECT
            event_version,
            timestamp,
            organization_id,
            project_id,
            environment_id,
            service_name,
            storage_trace_id,
            trace_id,
            span_id,
            parent_span_id,
            span_name,
            deployment_id,
            model_provider,
            model_family,
            model_revision,
            prompt_version_id,
            prompt_hash,
            model_version_id,
            latency_ms,
            success,
            error_type,
            input_tokens,
            output_tokens,
            cost_usd,
            structured_output_valid,
            guardrail_policy,
            guardrail_action,
            guardrail_triggered,
            retrieval_latency_ms,
            retrieval_chunks,
            incident_flag,
            metadata_json
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE timestamp >= parseDateTime64BestEffort({{window_start:String}})
          AND timestamp < parseDateTime64BestEffort({{window_end:String}})
        ORDER BY timestamp DESC, storage_trace_id DESC
        {limit_clause}
        FORMAT JSONEachRow
        """
        response = self._post(sql, params=params)
        rows: list[TraceWarehouseEventRow] = []
        for line in response.text.splitlines():
            if not line:
                continue
            payload = json.loads(line)
            rows.append(
                TraceWarehouseEventRow(
                    event_version=int(payload.get("event_version", 1)),
                    timestamp=_ensure_utc(datetime.fromisoformat(payload["timestamp"])),
                    organization_id=UUID(payload["organization_id"]),
                    project_id=UUID(payload["project_id"]),
                    environment_id=UUID(payload["environment_id"]) if payload.get("environment_id") else None,
                    service_name=payload.get("service_name"),
                    storage_trace_id=UUID(payload["storage_trace_id"]),
                    trace_id=payload.get("trace_id"),
                    span_id=payload.get("span_id"),
                    parent_span_id=payload.get("parent_span_id"),
                    span_name=payload.get("span_name"),
                    deployment_id=UUID(payload["deployment_id"]) if payload.get("deployment_id") else None,
                    model_provider=payload.get("model_provider"),
                    model_family=payload.get("model_family"),
                    model_revision=payload.get("model_revision"),
                    prompt_version_id=payload.get("prompt_version_id"),
                    prompt_hash=payload.get("prompt_hash"),
                    model_version_id=UUID(payload["model_version_id"]) if payload.get("model_version_id") else None,
                    latency_ms=payload.get("latency_ms"),
                    success=bool(payload.get("success")),
                    error_type=payload.get("error_type"),
                    input_tokens=payload.get("input_tokens"),
                    output_tokens=payload.get("output_tokens"),
                    cost_usd=Decimal(str(payload["cost_usd"])) if payload.get("cost_usd") is not None else None,
                    structured_output_valid=payload.get("structured_output_valid"),
                    guardrail_policy=payload.get("guardrail_policy"),
                    guardrail_action=payload.get("guardrail_action"),
                    guardrail_triggered=bool(payload.get("guardrail_triggered", False)),
                    retrieval_latency_ms=payload.get("retrieval_latency_ms"),
                    retrieval_chunks=payload.get("retrieval_chunks"),
                    incident_flag=bool(payload.get("incident_flag", False)),
                    metadata_json=json.loads(payload.get("metadata_json") or "{}"),
                )
            )
        return rows

    def get_warehouse_stats(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
    ) -> dict[str, Any]:
        self.ensure_schema()
        try:
            parts_sql = f"""
            SELECT
                sum(rows) AS warehouse_rows,
                countDistinct(partition) AS active_partitions
            FROM system.parts
            WHERE database = {{database:String}}
              AND table = '{TRACE_WAREHOUSE_TABLE}'
              AND active = 1
            FORMAT JSONEachRow
            """
            parts_response = self._post(parts_sql, params={"database": self.database})
            parts_line = next((item for item in parts_response.text.splitlines() if item.strip()), "")
            query_log_sql = """
            SELECT
                avg(query_duration_ms) AS avg_query_latency,
                sum(read_rows) / greatest(dateDiff('second', min(event_time), max(event_time)), 1) AS scan_rate
            FROM system.query_log
            WHERE event_time >= parseDateTime64BestEffort({window_start:String})
              AND event_time < parseDateTime64BestEffort({window_end:String})
              AND type = 'QueryFinish'
              AND lower(query) LIKE '%trace_warehouse%'
            FORMAT JSONEachRow
            """
            query_response = self._post(
                query_log_sql,
                params={
                    "window_start": _ensure_utc(window_start).isoformat(),
                    "window_end": _ensure_utc(window_end).isoformat(),
                },
            )
            query_line = next((item for item in query_response.text.splitlines() if item.strip()), "")
            if parts_line:
                parts_payload = json.loads(parts_line)
                query_payload = json.loads(query_line) if query_line else {}
                return {
                    "warehouse_rows": int(parts_payload.get("warehouse_rows", 0) or 0),
                    "active_partitions": int(parts_payload.get("active_partitions", 0) or 0),
                    "scan_rate": float(query_payload.get("scan_rate", 0.0) or 0.0),
                    "avg_query_latency": float(query_payload.get("avg_query_latency", 0.0) or 0.0),
                }
        except Exception:
            logger.debug("falling back to adapter warehouse metrics", exc_info=True)
        params = {
            "window_start": _ensure_utc(window_start).isoformat(),
            "window_end": _ensure_utc(window_end).isoformat(),
        }
        sql = f"""
        SELECT
            count() AS warehouse_rows,
            uniq(toDate(timestamp)) AS active_partitions
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE timestamp >= parseDateTime64BestEffort({{window_start:String}})
          AND timestamp < parseDateTime64BestEffort({{window_end:String}})
        FORMAT JSONEachRow
        """
        response = self._post(sql, params=params)
        line = next((item for item in response.text.splitlines() if item.strip()), "")
        if not line:
            return {
                "warehouse_rows": 0,
                "active_partitions": 0,
                "scan_rate": 0.0,
                "avg_query_latency": 0.0,
            }
        payload = json.loads(line)
        return {
            "warehouse_rows": int(payload.get("warehouse_rows", 0)),
            "active_partitions": int(payload.get("active_partitions", 0)),
            "scan_rate": 0.0,
            "avg_query_latency": 0.0,
        }


class WarehouseQueryViolation(HTTPException):
    def __init__(self, detail: str = "Warehouse-backed query required for this time window") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _enforce_event_window(window_start: datetime, window_end: datetime) -> None:
    if _ensure_utc(window_end) - _ensure_utc(window_start) > MAX_EVENT_WINDOW:
        raise WarehouseQueryViolation("Long-window analytics must use rollup tables.")


def _assert_router_context() -> None:
    if not contextvar_router_active.get():
        raise RuntimeError("trace_warehouse accessed outside router")




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


def build_trace_event_row_from_payload(payload: dict[str, Any]) -> TraceWarehouseEventRow:
    event = validate_trace_event(payload)
    return TraceWarehouseEventRow(
        event_version=int(event["event_version"]),
        timestamp=_ensure_utc(datetime.fromisoformat(event["timestamp"])),
        organization_id=UUID(event["organization_id"]),
        project_id=UUID(event["project_id"]),
        environment_id=UUID(event["environment_id"]) if event.get("environment_id") else None,
        service_name=event.get("service_name"),
        storage_trace_id=UUID(event["trace_id"]),
        trace_id=_metadata_trace_field(event.get("metadata") or {}, "trace_id", "reliai_trace_id") or event["trace_id"],
        span_id=_metadata_trace_field(event.get("metadata") or {}, "span_id", "reliai_span_id") or event["trace_id"],
        parent_span_id=_metadata_trace_field(event.get("metadata") or {}, "parent_span_id", "reliai_parent_span_id"),
        span_name=_metadata_trace_field(event.get("metadata") or {}, "span_name"),
        deployment_id=UUID(str((event.get("metadata") or {}).get("deployment_id")))
        if (event.get("metadata") or {}).get("deployment_id")
        else None,
        model_provider=(event.get("model") or {}).get("provider"),
        model_family=(event.get("model") or {}).get("family"),
        model_revision=(event.get("model") or {}).get("revision"),
        prompt_version_id=event.get("prompt_version_id"),
        prompt_hash=_prompt_hash(event.get("prompt_version_id"), event.get("metadata") or {}),
        model_version_id=UUID(event["model_version_id"]) if event.get("model_version_id") else None,
        latency_ms=event.get("latency_ms"),
        success=bool(event["success"]),
        error_type=(event.get("metadata") or {}).get("error_type"),
        input_tokens=(event.get("tokens") or {}).get("input"),
        output_tokens=(event.get("tokens") or {}).get("output"),
        cost_usd=Decimal(str(event["cost_usd"])) if event.get("cost_usd") is not None else None,
        structured_output_valid=(event.get("evaluation") or {}).get("structured_output_valid"),
        guardrail_policy=_metadata_trace_field(event.get("metadata") or {}, "guardrail_policy", "policy_type"),
        guardrail_action=_metadata_trace_field(event.get("metadata") or {}, "guardrail_action"),
        guardrail_triggered=bool(_metadata_trace_field(event.get("metadata") or {}, "guardrail_policy", "policy_type")),
        retrieval_latency_ms=(event.get("retrieval") or {}).get("latency_ms"),
        retrieval_chunks=(event.get("retrieval") or {}).get("chunks"),
        incident_flag=bool((event.get("metadata") or {}).get("incident_flag", False)),
        metadata_json=event.get("metadata") or {},
    )


def build_trace_event_row(trace: Trace) -> TraceWarehouseEventRow:
    return build_trace_event_row_from_payload(
        build_trace_event_payload(
            trace,
            event_type="trace_evaluated",
            structured_output_valid=_structured_output_valid(trace),
            quality_pass=_structured_output_valid(trace),
            metadata_overrides={"error_type": trace.error_type} if trace.error_type is not None else None,
        )
    )


def ingest_trace_event(trace: Trace) -> None:
    client = get_trace_warehouse_client()
    try:
        client.insert_trace_events([build_trace_event_row(trace)])
    except Exception:
        logger.exception("failed to ingest trace event into warehouse", extra={"trace_id": str(trace.id)})


def ingest_trace_event_payload(payload: dict[str, Any]) -> None:
    client = get_trace_warehouse_client()
    event = validate_trace_event(payload)
    try:
        client.insert_trace_events([build_trace_event_row_from_payload(event)])
    except Exception:
        logger.exception(
            "failed to ingest trace event payload into warehouse",
            extra={"trace_id": event.get("trace_id")},
        )


def _query_traces(filters: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
    _assert_router_context()
    _enforce_event_window(filters.window_start, filters.window_end)
    return get_trace_warehouse_client().query_trace_events(filters)


def _query_all_traces(
    *,
    window_start: datetime,
    window_end: datetime,
    limit: int | None = None,
) -> list[TraceWarehouseEventRow]:
    _assert_router_context()
    _enforce_event_window(window_start, window_end)
    return get_trace_warehouse_client().query_all_trace_events(
        window_start=window_start,
        window_end=window_end,
        limit=limit,
    )


def _aggregate_trace_metrics(query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
    """Deprecated for long-window analytics.

    Use rollup queries through the trace query router for any analytics window
    greater than ``MAX_EVENT_WINDOW``.
    """
    _assert_router_context()
    _enforce_event_window(query.window_start, query.window_end)
    return get_trace_warehouse_client().aggregate_trace_metrics(query)


def _count_distinct_services(
    *,
    organization_id: UUID,
    project_id: UUID,
    environment_id: UUID | None,
    window_start: datetime,
    window_end: datetime,
) -> int:
    _assert_router_context()
    _enforce_event_window(window_start, window_end)
    return get_trace_warehouse_client().count_distinct_services(
        organization_id=organization_id,
        project_id=project_id,
        environment_id=environment_id,
        window_start=window_start,
        window_end=window_end,
    )


def _query_hourly_metrics(
    *,
    project_id: UUID | None,
    environment_id: UUID | None,
    start_time: datetime,
    end_time: datetime,
) -> list[TraceWarehouseRollupRow]:
    _assert_router_context()
    return get_trace_warehouse_client().query_hourly_metrics(
        project_id=project_id,
        environment_id=environment_id,
        start_time=start_time,
        end_time=end_time,
    )


def _query_daily_metrics(
    *,
    project_id: UUID | None,
    environment_id: UUID | None,
    start_time: datetime,
    end_time: datetime,
) -> list[TraceWarehouseRollupRow]:
    _assert_router_context()
    return get_trace_warehouse_client().query_daily_metrics(
        project_id=project_id,
        environment_id=environment_id,
        start_time=start_time,
        end_time=end_time,
    )


def get_warehouse_stats(*, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    return get_trace_warehouse_client().get_warehouse_stats(
        window_start=window_start,
        window_end=window_end,
    )
def _metadata_trace_field(metadata: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = metadata.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None
