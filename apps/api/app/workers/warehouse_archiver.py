from __future__ import annotations

from app.db.session import SessionLocal
from app.services.warehouse_archiver import archive_old_partitions


def run_warehouse_archiver() -> dict[str, object]:
    db = SessionLocal()
    try:
        return archive_old_partitions(db)
    finally:
        db.close()
