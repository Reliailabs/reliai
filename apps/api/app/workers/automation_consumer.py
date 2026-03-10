from __future__ import annotations

from app.processors.runner import run_processor_runner
from app.services.event_processing_metrics import CONSUMER_AUTOMATION
from app.services.event_stream import (
    DEPLOYMENT_CREATED_EVENT,
    REGRESSION_DETECTED_EVENT,
    TRACE_EVALUATED_EVENT,
)


def run_automation_consumer(*, max_events: int | None = None) -> int:
    return len(
        run_processor_runner(
            max_events=max_events,
            enabled_processors=["automation"],
            group_id="reliai.automation",
            consumer_name=CONSUMER_AUTOMATION,
            accepted_event_types={TRACE_EVALUATED_EVENT, REGRESSION_DETECTED_EVENT, DEPLOYMENT_CREATED_EVENT},
        )
    )
