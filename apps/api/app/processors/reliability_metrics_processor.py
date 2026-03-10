from __future__ import annotations

from datetime import datetime, timezone

from app.events import validate_trace_event
from app.core.settings import get_settings
from app.processors.base_processor import BaseProcessor
from app.workers.reliability_metrics import run_project_reliability_metrics
from app.services.event_stream import TRACE_EVALUATED_EVENT


def _parse_timestamp(raw_value: str) -> datetime:
    parsed = datetime.fromisoformat(raw_value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class ReliabilityMetricsProcessor(BaseProcessor):
    name = "reliability_metrics"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != TRACE_EVALUATED_EVENT:
            return
        payload = validate_trace_event(event.payload)
        run_project_reliability_metrics(
            str(payload["project_id"]),
            payload.get("prompt_version_id"),
            None,
            _parse_timestamp(str(payload["timestamp"])).isoformat(),
        )
