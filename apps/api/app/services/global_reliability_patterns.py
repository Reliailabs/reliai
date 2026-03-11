from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.reliability_graph import get_high_risk_patterns


def get_global_reliability_patterns(db: Session) -> list[dict]:
    return get_high_risk_patterns(db, organization_ids=None, limit=25)
