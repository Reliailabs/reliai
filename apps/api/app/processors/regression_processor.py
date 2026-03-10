from __future__ import annotations

from app.core.settings import get_settings
from app.processors.base_processor import BaseProcessor
from app.workers.regression_detection import run_trace_regression_detection


class RegressionProcessor(BaseProcessor):
    name = "regression"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != "trace_ingested":
            return
        run_trace_regression_detection(str(event.payload["trace_id"]))
