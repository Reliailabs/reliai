from __future__ import annotations

from app.db.session import SessionLocal
from app.services.global_reliability_patterns import run_global_pattern_mining_for_session


def run_global_pattern_mining(anchor_time: str | None = None) -> int:
    db = SessionLocal()
    try:
        rows = run_global_pattern_mining_for_session(db, anchor_time=anchor_time)
        db.commit()
        return len(rows)
    finally:
        db.close()
