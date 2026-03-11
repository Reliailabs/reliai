from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GlobalReliabilityPattern(Base):
    __tablename__ = "global_reliability_patterns"
    __table_args__ = (
        Index(
            "ix_global_reliability_patterns_confidence_occurrence",
            "confidence_score",
            "occurrence_count",
        ),
        Index(
            "ix_global_reliability_patterns_type_created_at",
            "pattern_type",
            "created_at",
        ),
    )

    pattern_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pattern_type: Mapped[str] = mapped_column(String(64), nullable=False)
    conditions_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    impact_metrics_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False)
    organizations_affected: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
