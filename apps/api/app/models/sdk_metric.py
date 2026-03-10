from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SDKMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sdk_metrics"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "project_id",
            "environment_id",
            "bucket_start",
            "sdk_version",
            "language",
            name="uq_sdk_metrics_bucket_scope",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    environment_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("environments.id"), nullable=True, index=True
    )
    bucket_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    sdk_version: Mapped[str] = mapped_column(String(64), nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    latency_ms_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_ms_p95: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    organization = relationship("Organization")
    project = relationship("Project")
    environment = relationship("Environment")
