from uuid import UUID

from app.db.session import SessionLocal
from app.services.customer_exports import run_customer_export_for_session


def run_customer_export(export_id: str) -> None:
    db = SessionLocal()
    try:
        run_customer_export_for_session(db, export_id=UUID(export_id))
    finally:
        db.close()
