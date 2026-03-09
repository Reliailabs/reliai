from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EvaluationRollup(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "evaluation_rollups"
    __table_args__ = (
        UniqueConstraint(
            "scope_type",
            "scope_id",
            "metric_name",
            "window_minutes",
            "window_start",
            "window_end",
            name="uq_evaluation_rollups_scope_metric_window",
        ),
        Index("ix_evaluation_rollups_project_window", "project_id", "window_minutes"),
        Index("ix_evaluation_rollups_organization_window", "organization_id", "window_minutes"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(128), nullable=False)
    window_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    metric_value: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    project = relationship("Project", back_populates="evaluation_rollups")
