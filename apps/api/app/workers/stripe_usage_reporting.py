from __future__ import annotations

from app.db.session import SessionLocal
from app.services.stripe_usage import report_usage_to_stripe, sync_monthly_usage


def run_stripe_usage_reporting() -> dict[str, int]:
    db = SessionLocal()
    try:
        sync_monthly_usage(db)
        reported = report_usage_to_stripe(db)
    finally:
        db.close()
    return {"usage_reported": int(reported)}
