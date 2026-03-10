from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from time import perf_counter

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.event_processing_metric import EventProcessingMetric
from app.models.trace import Trace
from app.services.event_stream import EventMessage, publish_event

logger = logging.getLogger(__name__)

WINDOW_MINUTES = 15
CONSUMER_EVALUATION = "evaluation_consumer"
CONSUMER_TRACE_WAREHOUSE = "trace_warehouse_consumer"
CONSUMER_RELIABILITY_METRICS = "reliability_metrics_consumer"
CONSUMER_REGRESSION_DETECTION = "regression_detection_consumer"

CONSUMER_TOPICS = {
    CONSUMER_EVALUATION: "trace_events",
    CONSUMER_TRACE_WAREHOUSE: "trace_events",
    CONSUMER_RELIABILITY_METRICS: "trace_events",
    CONSUMER_REGRESSION_DETECTION: "trace_events",
}


@dataclass(frozen=True)
class EventPipelineConsumerStatus:
    consumer_name: str
    topic: str
    health: str
    processing_rate_per_minute: float
    lag: int
    processed_events_total: int
    processed_events_recent: int
    error_count_total: int
    error_count_recent: int
    average_processing_latency_ms: float | None
    last_processed_at: datetime | None
    last_error_at: datetime | None


@dataclass(frozen=True)
class EventPipelineStatus:
    topic: str
    dead_letter_topic: str | None
    total_events_published: int
    recent_events_published: int
    window_minutes: int
    consumers: list[EventPipelineConsumerStatus]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _metric_topic(consumer: str) -> str:
    if consumer not in CONSUMER_TOPICS:
        raise ValueError(f"Unknown consumer '{consumer}'")
    return get_settings().event_stream_topic_traces


def record_event_processing(consumer: str, latency: int) -> None:
    db = SessionLocal()
    try:
        db.add(
            EventProcessingMetric(
                consumer_name=consumer,
                topic=_metric_topic(consumer),
                events_processed=1,
                processing_latency_ms=max(0, int(latency)),
                error_count=0,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("failed to record event processing metric", extra={"consumer_name": consumer})
    finally:
        db.close()


def record_event_error(consumer: str) -> None:
    db = SessionLocal()
    try:
        db.add(
            EventProcessingMetric(
                consumer_name=consumer,
                topic=_metric_topic(consumer),
                events_processed=0,
                processing_latency_ms=0,
                error_count=1,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("failed to record event processing error metric", extra={"consumer_name": consumer})
    finally:
        db.close()


def publish_dead_letter_event(message: EventMessage, *, consumer: str, error: Exception) -> None:
    topic = (get_settings().event_stream_topic_traces_dlq or "").strip()
    if not topic:
        return
    try:
        payload = {
            "event_type": "trace_ingested_dead_letter",
            "project_id": message.payload.get("project_id"),
            "trace_id": message.payload.get("trace_id"),
            "source_topic": message.topic,
            "source_partition": message.partition,
            "source_offset": message.offset,
            "consumer_name": consumer,
            "failed_at": _utc_now().isoformat(),
            "error_message": str(error),
            "original_event_type": message.event_type,
            "original_payload": message.payload,
        }
        publish_event(topic, payload)
    except Exception:
        logger.exception(
            "failed to publish dead letter event",
            extra={"consumer_name": consumer, "topic": topic},
        )


def run_consumer_handler(
    consumer: str,
    message: EventMessage,
    handler: Callable[[], None],
) -> bool:
    started = perf_counter()
    try:
        handler()
    except Exception as exc:
        record_event_error(consumer)
        publish_dead_letter_event(message, consumer=consumer, error=exc)
        logger.exception(
            "consumer failed to process event",
            extra={
                "consumer_name": consumer,
                "topic": message.topic,
                "partition": message.partition,
                "offset": message.offset,
                "trace_id": message.payload.get("trace_id"),
            },
        )
        return False

    latency_ms = int((perf_counter() - started) * 1000)
    record_event_processing(consumer, latency_ms)
    return True


def _health(*, lag: int, processed_recent: int, errors_recent: int, last_processed_at: datetime | None) -> str:
    if lag <= 0 and processed_recent == 0 and errors_recent == 0 and last_processed_at is None:
        return "idle"
    if errors_recent > 0:
        return "degraded"
    if lag > 0 and processed_recent == 0:
        return "stalled"
    return "healthy"


def get_event_pipeline_status(db: Session) -> EventPipelineStatus:
    now = _utc_now()
    window_start = now - timedelta(minutes=WINDOW_MINUTES)
    settings = get_settings()
    topic = settings.event_stream_topic_traces

    total_events_published = int(db.scalar(select(func.count(Trace.id))) or 0)
    recent_events_published = int(
        db.scalar(select(func.count(Trace.id)).where(Trace.created_at >= window_start)) or 0
    )

    consumers: list[EventPipelineConsumerStatus] = []
    for consumer_name in CONSUMER_TOPICS:
        row = db.execute(
            select(
                func.coalesce(func.sum(EventProcessingMetric.events_processed), 0).label("processed_total"),
                func.coalesce(func.sum(EventProcessingMetric.error_count), 0).label("errors_total"),
                func.coalesce(
                    func.sum(
                        case(
                            (EventProcessingMetric.created_at >= window_start, EventProcessingMetric.events_processed),
                            else_=0,
                        )
                    ),
                    0,
                ).label("processed_recent"),
                func.coalesce(
                    func.sum(
                        case(
                            (EventProcessingMetric.created_at >= window_start, EventProcessingMetric.error_count),
                            else_=0,
                        )
                    ),
                    0,
                ).label("errors_recent"),
                func.avg(
                    case(
                        (EventProcessingMetric.events_processed > 0, EventProcessingMetric.processing_latency_ms),
                        else_=None,
                    )
                ).label("avg_latency_ms"),
                func.max(
                    case(
                        (EventProcessingMetric.events_processed > 0, EventProcessingMetric.created_at),
                        else_=None,
                    )
                ).label("last_processed_at"),
                func.max(
                    case(
                        (EventProcessingMetric.error_count > 0, EventProcessingMetric.created_at),
                        else_=None,
                    )
                ).label("last_error_at"),
            ).where(EventProcessingMetric.consumer_name == consumer_name)
        ).one()

        processed_total = int(row.processed_total or 0)
        processed_recent = int(row.processed_recent or 0)
        errors_total = int(row.errors_total or 0)
        errors_recent = int(row.errors_recent or 0)
        lag = max(total_events_published - processed_total, 0)
        consumers.append(
            EventPipelineConsumerStatus(
                consumer_name=consumer_name,
                topic=topic,
                health=_health(
                    lag=lag,
                    processed_recent=processed_recent,
                    errors_recent=errors_recent,
                    last_processed_at=row.last_processed_at,
                ),
                processing_rate_per_minute=round(processed_recent / WINDOW_MINUTES, 2),
                lag=lag,
                processed_events_total=processed_total,
                processed_events_recent=processed_recent,
                error_count_total=errors_total,
                error_count_recent=errors_recent,
                average_processing_latency_ms=(
                    round(float(row.avg_latency_ms), 2) if row.avg_latency_ms is not None else None
                ),
                last_processed_at=row.last_processed_at,
                last_error_at=row.last_error_at,
            )
        )

    consumers.sort(key=lambda item: (item.health != "degraded", item.health != "stalled", item.consumer_name))
    return EventPipelineStatus(
        topic=topic,
        dead_letter_topic=(settings.event_stream_topic_traces_dlq or "").strip() or None,
        total_events_published=total_events_published,
        recent_events_published=recent_events_published,
        window_minutes=WINDOW_MINUTES,
        consumers=consumers,
    )
