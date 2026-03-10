from __future__ import annotations

from app.services.event_processing_metrics import CONSUMER_EVALUATION
from app.processors.runner import run_processor_runner


def run_evaluation_consumer(*, max_events: int | None = None) -> int:
    return len(
        run_processor_runner(
            max_events=max_events,
            enabled_processors=["evaluation"],
            group_id="reliai.evaluation",
            consumer_name=CONSUMER_EVALUATION,
        )
    )
