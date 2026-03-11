from __future__ import annotations

from datetime import timezone
from uuid import UUID

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.processors.dispatcher import dispatch_event_sync
from app.processors.registry import processors_for_topic
from app.services.event_log import list_event_log_entries
from app.services.event_stream import EventMessage


def _topic_for_event_type(event_type: str) -> str:
    del event_type
    return get_settings().event_stream_topic_traces


def reprocess_events(
    *,
    max_events: int | None = None,
    event_types: list[str] | None = None,
    project_id: UUID | None = None,
) -> int:
    db = SessionLocal()
    try:
        rows = list_event_log_entries(
            db,
            event_types=event_types,
            project_id=project_id,
            limit=max_events,
        )
        replayed = 0
        for offset, row in enumerate(rows):
            topic = _topic_for_event_type(row.event_type)
            if not processors_for_topic(topic):
                continue
            dispatch_event_sync(
                EventMessage(
                    topic=topic,
                    key=str(row.project_id or ""),
                    partition=0,
                    offset=offset,
                    event_type=row.event_type,
                    payload=row.payload_json,
                    published_at=(
                        row.timestamp if row.timestamp.tzinfo is not None else row.timestamp.replace(tzinfo=timezone.utc)
                    ),
                )
            )
            replayed += 1
        return replayed
    finally:
        db.close()
