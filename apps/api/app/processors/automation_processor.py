from __future__ import annotations

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.processors.base_processor import BaseProcessor
from app.services.automation_rules import evaluate_automation_rules
from app.services.event_stream import (
    DEPLOYMENT_CREATED_EVENT,
    REGRESSION_DETECTED_EVENT,
    TRACE_EVALUATED_EVENT,
)


class AutomationProcessor(BaseProcessor):
    name = "automation"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type not in {TRACE_EVALUATED_EVENT, REGRESSION_DETECTED_EVENT, DEPLOYMENT_CREATED_EVENT}:
            return
        db = SessionLocal()
        try:
            evaluate_automation_rules(db, event)
        finally:
            db.close()
