from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class ReliabilityPattern(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reliability_patterns"
    __table_args__ = (
        Index(
            "ix_reliability_patterns_type_model_prompt_failure",
            "pattern_type",
            "model_family",
            "prompt_pattern_hash",
            "failure_type",
            unique=True,
        ),
        Index(
            "ix_reliability_patterns_probability_last_seen",
            "failure_probability",
            "last_seen_at",
        ),
    )

    pattern_type: Mapped[str] = mapped_column(String(64), nullable=False)
    model_family: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_pattern_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_type: Mapped[str] = mapped_column(String(64), nullable=False)
    failure_probability: Mapped[float] = mapped_column(Float, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
