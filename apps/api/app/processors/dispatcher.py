from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass

from app.processors.base_processor import BaseProcessor
from app.processors.registry import processors_for_topic
from app.services.external_processors import dispatch_external_processors
from app.services.event_stream import EventMessage

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessorDispatchResult:
    processor_name: str
    success: bool
    attempts: int
    error: str | None = None


@dataclass(frozen=True)
class DispatchReport:
    topic: str
    processor_results: list[ProcessorDispatchResult]


async def dispatch_event(
    event: EventMessage,
    *,
    processors: list[BaseProcessor] | None = None,
) -> DispatchReport:
    if processors is None:
        processors = processors_for_topic(event.topic)

    results: list[ProcessorDispatchResult] = []
    for processor in processors:
        attempts = 0
        last_error: Exception | None = None
        max_attempts = max(1, processor.max_retries)
        while attempts < max_attempts:
            attempts += 1
            payload_before = json.dumps(event.payload, sort_keys=True, separators=(",", ":"), default=str)
            try:
                await processor.process(event)
                payload_after = json.dumps(event.payload, sort_keys=True, separators=(",", ":"), default=str)
                if payload_after != payload_before:
                    raise RuntimeError(f"processor {processor.name} mutated input event")
                results.append(
                    ProcessorDispatchResult(
                        processor_name=processor.name,
                        success=True,
                        attempts=attempts,
                    )
                )
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                logger.exception(
                    "processor execution failed",
                    extra={
                        "processor": processor.name,
                        "topic": event.topic,
                        "attempt": attempts,
                    },
                )
        if last_error is not None:
            results.append(
                ProcessorDispatchResult(
                    processor_name=processor.name,
                    success=False,
                    attempts=attempts,
                    error=str(last_error),
                )
            )
    for external_result in dispatch_external_processors(event):
        results.append(
            ProcessorDispatchResult(
                processor_name=external_result.processor_name,
                success=external_result.success,
                attempts=external_result.attempts,
                error=external_result.error,
            )
        )
    return DispatchReport(topic=event.topic, processor_results=results)


def dispatch_event_sync(
    event: EventMessage,
    *,
    processors: list[BaseProcessor] | None = None,
) -> DispatchReport:
    return asyncio.run(dispatch_event(event, processors=processors))
