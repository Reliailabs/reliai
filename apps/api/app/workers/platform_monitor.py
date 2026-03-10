from __future__ import annotations

from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.services.event_stream import (
    PLATFORM_DEGRADED_EVENT,
    PLATFORM_RECOVERED_EVENT,
    publish_event,
)
from app.services.platform_metrics import get_platform_monitor_snapshot


def run_platform_monitor() -> dict:
    db = SessionLocal()
    try:
        snapshot = get_platform_monitor_snapshot(db)
    finally:
        db.close()
    event_type = PLATFORM_DEGRADED_EVENT if snapshot["customer_overload_risk"] in {"high", "critical"} else PLATFORM_RECOVERED_EVENT
    publish_event(
        "trace_events",
        {
            "event_type": event_type,
            "project_id": "system",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": snapshot,
        },
    )
    return snapshot
