from __future__ import annotations

import logging
from time import perf_counter

from app.core.settings import get_settings
from app.processors.dispatcher import DispatchReport, dispatch_event_sync
from app.processors.registry import enabled_processor_names, get_processor_registry, processors_for_topic
from app.services.event_stream import TRACE_EVENT_CONSUMER_GROUP_PREFIX, consume_events
from app.services.event_processing_metrics import (
    publish_dead_letter_event,
    record_event_error,
    record_event_processing,
)

logger = logging.getLogger(__name__)


def run_processor_runner(
    *,
    max_events: int | None = None,
    enabled_processors: list[str] | None = None,
    group_id: str | None = None,
    consumer_name: str | None = None,
    accepted_event_types: set[str] | None = None,
) -> list[DispatchReport]:
    settings = get_settings()
    registry = get_processor_registry()
    selected_processors = set(enabled_processors) if enabled_processors is not None else enabled_processor_names()
    reports: list[DispatchReport] = []

    for topic in registry.subscribed_topics():
        if not processors_for_topic(topic, enabled_processors=selected_processors):
            continue
        for message in consume_events(
            topic,
            group_id=group_id or f"{TRACE_EVENT_CONSUMER_GROUP_PREFIX}.processors",
            max_events=None if accepted_event_types is not None else max_events,
            timeout_ms=settings.event_stream_consumer_timeout_ms,
        ):
            if accepted_event_types is not None and message.event_type not in accepted_event_types:
                continue
            processors = processors_for_topic(message.topic, enabled_processors=selected_processors)
            if not processors:
                logger.info("no processors enabled for topic", extra={"topic": message.topic})
                continue
            started = perf_counter()
            report = dispatch_event_sync(message, processors=processors)
            latency_ms = int((perf_counter() - started) * 1000)
            if consumer_name is not None:
                failed = next((item for item in report.processor_results if not item.success), None)
                if failed is None:
                    record_event_processing(consumer_name, latency_ms)
                else:
                    record_event_error(consumer_name)
                    publish_dead_letter_event(
                        message,
                        consumer=consumer_name,
                        error=RuntimeError(failed.error or "processor execution failed"),
                    )
            reports.append(report)
            if max_events is not None and len(reports) >= max_events:
                return reports
    return reports
