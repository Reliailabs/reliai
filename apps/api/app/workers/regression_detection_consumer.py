from __future__ import annotations

from app.services.event_processing_metrics import CONSUMER_REGRESSION_DETECTION
from app.processors.runner import run_processor_runner


def run_regression_detection_consumer(*, max_events: int | None = None) -> int:
    return len(
        run_processor_runner(
            max_events=max_events,
            enabled_processors=["regression"],
            group_id="reliai.regression-detection",
            consumer_name=CONSUMER_REGRESSION_DETECTION,
        )
    )
