from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import asc, select
from sqlalchemy.orm import Session

from app.models.event_log import EventLog


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _coerce_uuid(value: object) -> UUID | None:
    if value in (None, ""):
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _event_timestamp(payload: dict, *, published_at: datetime) -> datetime:
    raw = payload.get("timestamp") or payload.get("detected_at") or payload.get("deployed_at")
    if isinstance(raw, datetime):
        return _as_utc(raw)
    if isinstance(raw, str):
        return _as_utc(datetime.fromisoformat(raw.replace("Z", "+00:00")))
    return _as_utc(published_at)


def _json_safe_payload(payload: dict) -> dict:
    return json.loads(json.dumps(payload, sort_keys=True, default=str))


def record_event_log(
    db: Session,
    *,
    event_type: str,
    payload: dict,
    published_at: datetime,
) -> EventLog:
    row = EventLog(
        event_type=event_type,
        organization_id=_coerce_uuid(payload.get("organization_id")),
        project_id=_coerce_uuid(payload.get("project_id")),
        trace_id=str(payload.get("trace_id")) if payload.get("trace_id") is not None else None,
        timestamp=_event_timestamp(payload, published_at=published_at),
        payload_json=_json_safe_payload(payload),
    )
    db.add(row)
    db.flush()
    return row


def list_event_log_entries(
    db: Session,
    *,
    event_types: list[str] | None = None,
    project_id: UUID | None = None,
    limit: int | None = None,
) -> list[EventLog]:
    statement = select(EventLog)
    if event_types:
        statement = statement.where(EventLog.event_type.in_(event_types))
    if project_id is not None:
        statement = statement.where(EventLog.project_id == project_id)
    statement = statement.order_by(asc(EventLog.timestamp), asc(EventLog.event_id))
    if limit is not None:
        statement = statement.limit(limit)
    return list(db.scalars(statement).all())
