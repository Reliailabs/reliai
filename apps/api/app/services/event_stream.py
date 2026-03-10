from __future__ import annotations

import json
import logging
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from hashlib import md5
from threading import Lock
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.core.settings import get_settings

logger = logging.getLogger(__name__)

TRACE_INGESTED_EVENT = "trace_ingested"
TRACE_EVALUATED_EVENT = "trace_evaluated"
REGRESSION_DETECTED_EVENT = "regression_detected"
DEPLOYMENT_CREATED_EVENT = "deployment_created"
AUTOMATION_TRIGGERED_EVENT = "automation_triggered"
SDK_REQUEST_EVENT = "sdk_request"
SDK_ERROR_EVENT = "sdk_error"
SDK_LATENCY_EVENT = "sdk_latency"
SDK_RETRY_EVENT = "sdk_retry"
PLATFORM_DEGRADED_EVENT = "platform_degraded"
PLATFORM_RECOVERED_EVENT = "platform_recovered"
SDK_EVENT_TYPES = {
    SDK_REQUEST_EVENT,
    SDK_ERROR_EVENT,
    SDK_LATENCY_EVENT,
    SDK_RETRY_EVENT,
}
TRACE_EVENT_CONSUMER_GROUP_PREFIX = "reliai"
IN_MEMORY_PARTITIONS = 8


class TraceIngestedEventPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: str = TRACE_INGESTED_EVENT
    trace_id: str
    project_id: str
    environment_id: str | None = None
    timestamp: datetime
    prompt_version_id: str | None = None
    model_version_id: str | None = None
    latency_ms: int | None = None
    success: bool
    metadata: dict[str, Any] | None = None


class TraceEvaluatedEventPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: str = TRACE_EVALUATED_EVENT
    trace_id: str
    project_id: str
    environment_id: str | None = None
    timestamp: datetime
    prompt_version_id: str | None = None
    model_version_id: str | None = None
    evaluation_result: dict[str, Any]
    structured_output_valid: bool | None = None
    latency_ms: int | None = None
    success: bool
    metadata: dict[str, Any] | None = None


class RegressionDetectedEventPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: str = REGRESSION_DETECTED_EVENT
    project_id: str
    environment_id: str | None = None
    regression_snapshot_id: str
    trace_id: str
    detected_at: datetime
    metric_name: str
    current_value: float
    baseline_value: float
    delta_absolute: float
    delta_percent: float | None = None
    scope_type: str
    scope_id: str
    metadata: dict[str, Any] | None = None


class DeploymentCreatedEventPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: str = DEPLOYMENT_CREATED_EVENT
    project_id: str
    environment_id: str | None = None
    deployment_id: str
    deployed_at: datetime
    environment: str
    deployed_by: str | None = None
    prompt_version_id: str | None = None
    model_version_id: str | None = None
    metadata: dict[str, Any] | None = None


class AutomationTriggeredEventPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: str = AUTOMATION_TRIGGERED_EVENT
    project_id: str
    rule_id: str
    source_event_type: str
    action_type: str
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class EventMessage:
    topic: str
    key: str
    partition: int
    offset: int
    event_type: str
    payload: dict[str, Any]
    published_at: datetime


class EventStreamClient:
    def publish(self, *, topic: str, key: str, payload: dict[str, Any]) -> EventMessage:  # pragma: no cover - interface only
        raise NotImplementedError

    def consume(
        self,
        topic: str,
        group_id: str | None = None,
        max_events: int | None = None,
        timeout_ms: int | None = None,
    ) -> Iterator[EventMessage]:  # pragma: no cover - interface only
        raise NotImplementedError


class InMemoryEventStreamClient(EventStreamClient):
    def __init__(self, *, partitions: int = IN_MEMORY_PARTITIONS) -> None:
        self.partitions = partitions
        self._messages: dict[str, list[EventMessage]] = defaultdict(list)
        self._partition_offsets: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
        self._lock = Lock()

    def publish(self, *, topic: str, key: str, payload: dict[str, Any]) -> EventMessage:
        partition = _partition_for_key(key=key, partitions=self.partitions)
        with self._lock:
            offset = self._partition_offsets[topic][partition]
            self._partition_offsets[topic][partition] += 1
            message = EventMessage(
                topic=topic,
                key=key,
                partition=partition,
                offset=offset,
                event_type=str(payload.get("event_type", "")),
                payload=payload,
                published_at=datetime.now(timezone.utc),
            )
            self._messages[topic].append(message)
            return message

    def consume(
        self,
        topic: str,
        group_id: str | None = None,
        max_events: int | None = None,
        timeout_ms: int | None = None,
    ) -> Iterator[EventMessage]:
        del group_id, timeout_ms
        messages = list(self._messages.get(topic, []))
        count = 0
        for message in messages:
            yield message
            count += 1
            if max_events is not None and count >= max_events:
                break

    def reset(self) -> None:
        with self._lock:
            self._messages.clear()
            self._partition_offsets.clear()


class KafkaEventStreamClient(EventStreamClient):
    def __init__(self, *, brokers: list[str]) -> None:
        try:
            from kafka import KafkaConsumer, KafkaProducer
        except ImportError as exc:  # pragma: no cover - exercised only when dependency is absent
            raise RuntimeError("kafka-python is required when EVENT_STREAM_BROKERS is configured") from exc

        self._KafkaConsumer = KafkaConsumer
        self._KafkaProducer = KafkaProducer
        self._brokers = brokers
        self._producer = KafkaProducer(
            bootstrap_servers=brokers,
            acks=0,
            linger_ms=5,
            retries=0,
            max_block_ms=250,
            request_timeout_ms=1000,
            key_serializer=lambda value: value.encode("utf-8"),
            value_serializer=lambda value: json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8"),
        )

    def publish(self, *, topic: str, key: str, payload: dict[str, Any]) -> EventMessage:
        partition = _partition_for_key(key=key, partitions=IN_MEMORY_PARTITIONS)
        self._producer.send(topic, key=key, value=payload)
        return EventMessage(
            topic=topic,
            key=key,
            partition=partition,
            offset=-1,
            event_type=str(payload.get("event_type", "")),
            payload=payload,
            published_at=datetime.now(timezone.utc),
        )

    def consume(
        self,
        topic: str,
        group_id: str | None = None,
        max_events: int | None = None,
        timeout_ms: int | None = None,
    ) -> Iterator[EventMessage]:
        settings = get_settings()
        consumer = self._KafkaConsumer(
            topic,
            bootstrap_servers=self._brokers,
            group_id=group_id or f"{TRACE_EVENT_CONSUMER_GROUP_PREFIX}.{topic}",
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            consumer_timeout_ms=timeout_ms or settings.event_stream_consumer_timeout_ms,
            key_deserializer=lambda value: value.decode("utf-8") if value is not None else "",
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )
        count = 0
        try:
            for record in consumer:
                message = EventMessage(
                    topic=record.topic,
                    key=record.key or "",
                    partition=record.partition,
                    offset=record.offset,
                    event_type=str(record.value.get("event_type", "")),
                    payload=record.value,
                    published_at=datetime.now(timezone.utc),
                )
                yield message
                count += 1
                if max_events is not None and count >= max_events:
                    break
        finally:
            consumer.close()


_in_memory_client = InMemoryEventStreamClient()


def _partition_for_key(*, key: str, partitions: int) -> int:
    digest = md5(key.encode("utf-8"), usedforsecurity=False).hexdigest()
    return int(digest, 16) % partitions


def _payload_key(payload: dict[str, Any]) -> str:
    project_id = payload.get("project_id")
    if not project_id:
        raise ValueError("event payload must include project_id for partitioning")
    return str(project_id)


@lru_cache(maxsize=1)
def get_event_stream_client() -> EventStreamClient:
    settings = get_settings()
    brokers = [item.strip() for item in (settings.event_stream_brokers or "").split(",") if item.strip()]
    if not brokers:
        return _in_memory_client
    return KafkaEventStreamClient(brokers=brokers)


def publish_event(topic: str, payload: dict[str, Any]) -> EventMessage:
    return get_event_stream_client().publish(topic=topic, key=_payload_key(payload), payload=payload)


def consume_events(
    topic: str,
    *,
    group_id: str | None = None,
    max_events: int | None = None,
    timeout_ms: int | None = None,
) -> Iterator[EventMessage]:
    yield from get_event_stream_client().consume(
        topic=topic,
        group_id=group_id,
        max_events=max_events,
        timeout_ms=timeout_ms,
    )


def reset_in_memory_event_stream() -> None:
    client = get_event_stream_client()
    if isinstance(client, InMemoryEventStreamClient):
        client.reset()
