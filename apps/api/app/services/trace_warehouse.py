from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
from typing import Any
from uuid import UUID

import httpx

from app.events import build_trace_event_payload, validate_trace_event
from app.core.settings import get_settings
from app.models.trace import Trace
from app.services.clickhouse_migrations import apply_migrations

logger = logging.getLogger(__name__)

TRACE_WAREHOUSE_TABLE = "trace_warehouse"
STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"


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
class TraceWarehouseEventRow:
    timestamp: datetime
    organization_id: UUID
    project_id: UUID
    environment_id: UUID | None
    trace_id: UUID
    success: bool
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
                    "trace_id": str(row.trace_id),
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
            trace_id,
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
            guardrail_triggered,
            retrieval_latency_ms,
            retrieval_chunks,
            incident_flag,
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
                    event_version=int(payload.get("event_version", 1)),
                    timestamp=datetime.fromisoformat(payload["timestamp"]),
                    organization_id=UUID(payload["organization_id"]),
                    project_id=UUID(payload["project_id"]),
                    environment_id=UUID(payload["environment_id"]) if payload.get("environment_id") else None,
                    trace_id=UUID(payload["trace_id"]),
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
                    guardrail_triggered=bool(payload.get("guardrail_triggered", False)),
                    retrieval_latency_ms=payload.get("retrieval_latency_ms"),
                    retrieval_chunks=payload.get("retrieval_chunks"),
                    incident_flag=bool(payload.get("incident_flag", False)),
                    metadata_json=json.loads(payload["metadata_json"]) if payload.get("metadata_json") else {},
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
            trace_id,
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
            guardrail_triggered,
            retrieval_latency_ms,
            retrieval_chunks,
            incident_flag,
            metadata_json
        FROM {TRACE_WAREHOUSE_TABLE}
        WHERE timestamp >= parseDateTime64BestEffort({{window_start:String}})
          AND timestamp < parseDateTime64BestEffort({{window_end:String}})
        ORDER BY timestamp DESC, trace_id DESC
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
                    trace_id=UUID(payload["trace_id"]),
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
        trace_id=UUID(event["trace_id"]),
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
        guardrail_triggered=bool((event.get("metadata") or {}).get("policy_type")),
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


def query_traces(filters: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
    return get_trace_warehouse_client().query_trace_events(filters)


def query_all_traces(
    *,
    window_start: datetime,
    window_end: datetime,
    limit: int | None = None,
) -> list[TraceWarehouseEventRow]:
    return get_trace_warehouse_client().query_all_trace_events(
        window_start=window_start,
        window_end=window_end,
        limit=limit,
    )


def aggregate_trace_metrics(query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
    return get_trace_warehouse_client().aggregate_trace_metrics(query)


def get_warehouse_stats(*, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    return get_trace_warehouse_client().get_warehouse_stats(
        window_start=window_start,
        window_end=window_end,
    )
