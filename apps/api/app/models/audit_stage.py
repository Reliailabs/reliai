from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditStage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_stages"

    audit_run_id: Mapped[UUID] = mapped_column(ForeignKey("audit_runs.id"), nullable=False, index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    internal_stage_key: Mapped[str] = mapped_column(String(64), nullable=False)
    stage_key: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    stage_label: Mapped[str] = mapped_column(String(64), nullable=False)
    stage_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_started")
    summary: Mapped[str | None] = mapped_column(Text)
    output_metadata: Mapped[dict | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    run = relationship("AuditRun", back_populates="stages")
