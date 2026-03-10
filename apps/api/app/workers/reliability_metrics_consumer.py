from __future__ import annotations

from app.services.event_processing_metrics import CONSUMER_RELIABILITY_METRICS
from app.processors.runner import run_processor_runner


def run_reliability_metrics_consumer(*, max_events: int | None = None) -> int:
    return len(
        run_processor_runner(
            max_events=max_events,
            enabled_processors=["reliability_metrics"],
            group_id="reliai.reliability-metrics",
            consumer_name=CONSUMER_RELIABILITY_METRICS,
        )
    )
