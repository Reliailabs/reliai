from __future__ import annotations

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.processors.base_processor import BaseProcessor
from app.services.event_stream import SDK_EVENT_TYPES
from app.services.sdk_metrics import record_sdk_event


class SDKMetricsProcessor(BaseProcessor):
    name = "sdk_metrics"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type not in SDK_EVENT_TYPES:
            return
        db = SessionLocal()
        try:
            record_sdk_event(db, event.payload)
        finally:
            db.close()
