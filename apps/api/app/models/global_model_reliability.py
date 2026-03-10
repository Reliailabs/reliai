from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GlobalModelReliability(Base):
    __tablename__ = "global_model_reliability"
    __table_args__ = (
        PrimaryKeyConstraint(
            "provider",
            "model_name",
            "metric_name",
            name="pk_global_model_reliability",
        ),
    )

    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
