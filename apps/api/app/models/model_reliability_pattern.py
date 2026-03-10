from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ModelReliabilityPattern(Base):
    __tablename__ = "model_reliability_patterns"
    __table_args__ = (
        PrimaryKeyConstraint("provider", "model_name", name="pk_model_reliability_patterns"),
    )

    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    failure_modes: Mapped[dict] = mapped_column(JSON, nullable=False)
    structured_output_failure_rate: Mapped[float] = mapped_column(Float, nullable=False)
    latency_percentiles: Mapped[dict] = mapped_column(JSON, nullable=False)
    cost_distribution: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
