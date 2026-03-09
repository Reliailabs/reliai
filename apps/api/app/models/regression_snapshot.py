from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class RegressionSnapshot(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "regression_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "scope_type",
            "scope_id",
            "metric_name",
            "window_minutes",
            name="uq_regression_snapshots_scope_metric_window",
        ),
        Index("ix_regression_snapshots_project_detected_at", "project_id", "detected_at"),
        Index("ix_regression_snapshots_organization_detected_at", "organization_id", "detected_at"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    metric_name: Mapped[str] = mapped_column(String(128), nullable=False)
    current_value: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    baseline_value: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    delta_absolute: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    delta_percent: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(255), nullable=False)
    window_minutes: Mapped[int] = mapped_column(nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    project = relationship("Project", back_populates="regression_snapshots")
