from __future__ import annotations

import logging

from app.core.settings import get_settings
from app.events import validate_trace_event
from app.processors.base_processor import BaseProcessor
from app.services.event_stream import TRACE_EVALUATED_EVENT
from app.services.trace_warehouse import ingest_trace_event_payload

logger = logging.getLogger(__name__)


def process_trace_warehouse_event(payload: dict) -> None:
    ingest_trace_event_payload(validate_trace_event(payload))


class WarehouseProcessor(BaseProcessor):
    name = "warehouse"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != TRACE_EVALUATED_EVENT:
            return
        process_trace_warehouse_event(event.payload)
