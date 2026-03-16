from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.organization_usage_expansion import OrganizationUsageExpansion
from app.services.customer_expansion_metrics import recompute_usage_expansion_metrics
from app.services.event_stream import BREAKOUT_ACCOUNT_DETECTED_EVENT, publish_event


def run_usage_expansion_metrics() -> dict[str, int]:
    db = SessionLocal()
    try:
        computed_at = datetime.now(timezone.utc)
        breakout_events = recompute_usage_expansion_metrics(db, computed_at=computed_at)
        db.commit()
        organizations_recomputed = int(db.scalar(select(func.count(OrganizationUsageExpansion.organization_id))) or 0)
    finally:
        db.close()

    for payload in breakout_events:
        publish_event(
            get_settings().event_stream_topic_traces,
            {
                "event_type": BREAKOUT_ACCOUNT_DETECTED_EVENT,
                **payload,
            },
        )
    return {
        "organizations_recomputed": organizations_recomputed,
        "breakout_events_emitted": len(breakout_events),
    }
