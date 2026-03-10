from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReliabilityMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reliability_metrics"
    __table_args__ = (
        Index(
            "ix_reliability_metrics_org_metric_window_end",
            "organization_id",
            "metric_name",
            "window_end",
        ),
        Index(
            "ix_reliability_metrics_project_metric_window_end",
            "project_id",
            "metric_name",
            "window_end",
        ),
        Index(
            "ix_reliability_metrics_scope_metric_window_end",
            "scope_type",
            "scope_id",
            "metric_name",
            "window_end",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(128), nullable=False)
    window_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    value_number: Mapped[float] = mapped_column(Float, nullable=False)
    numerator: Mapped[float | None] = mapped_column(Float)
    denominator: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    project = relationship("Project", back_populates="reliability_metrics")
