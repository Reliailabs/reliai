from __future__ import annotations

from app.events import validate_trace_event
from app.core.settings import get_settings
from app.processors.base_processor import BaseProcessor
from app.services.event_stream import TRACE_EVALUATED_EVENT
from app.workers.regression_detection import run_trace_regression_detection


class RegressionProcessor(BaseProcessor):
    name = "regression"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != TRACE_EVALUATED_EVENT:
            return
        payload = validate_trace_event(event.payload)
        run_trace_regression_detection(str(payload["trace_id"]))
