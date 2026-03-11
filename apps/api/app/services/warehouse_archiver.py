from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.trace import Trace

_LAST_ARCHIVE_AT: datetime | None = None


def _archive_dir() -> Path:
    path = Path(get_settings().warehouse_archive_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_archive_status(db: Session) -> dict[str, object]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    pending = int(db.scalar(select(func.count(Trace.id)).where(Trace.created_at < cutoff)) or 0)
    archived = len(list(_archive_dir().glob("*.json")))
    return {
        "archive_dir": str(_archive_dir()),
        "archived_partitions": archived,
        "pending_partitions": pending,
        "last_archive_at": _LAST_ARCHIVE_AT,
    }


def archive_old_partitions(db: Session) -> dict[str, object]:
    global _LAST_ARCHIVE_AT
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    rows = db.scalars(select(Trace).where(Trace.created_at < cutoff).order_by(Trace.created_at.asc())).all()
    if not rows:
        return get_archive_status(db)
    grouped: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        day = row.created_at.date().isoformat()
        grouped.setdefault(day, []).append(
            {
                "trace_id": str(row.id),
                "project_id": str(row.project_id),
                "environment_id": str(row.environment_id) if row.environment_id is not None else None,
                "created_at": row.created_at.isoformat(),
                "success": row.success,
                "latency_ms": row.latency_ms,
            }
        )
    for day, payload in grouped.items():
        (_archive_dir() / f"{day}.json").write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")
    _LAST_ARCHIVE_AT = datetime.now(timezone.utc)
    return get_archive_status(db)
