from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ProjectCustomMetric(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "project_custom_metrics"
    __table_args__ = (
        UniqueConstraint("project_id", "metric_key", name="uq_project_custom_metrics_project_key"),
        Index("ix_project_custom_metrics_project_enabled", "project_id", "enabled"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    metric_key: Mapped[str] = mapped_column(String(120), nullable=False)
    metric_type: Mapped[str] = mapped_column(String(32), nullable=False)
    value_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    pattern: Mapped[str | None] = mapped_column(String(500))
    keywords_json: Mapped[list[str] | None] = mapped_column(JSON)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="custom_metrics")
