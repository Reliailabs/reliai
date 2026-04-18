from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditFinding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_findings"

    audit_run_id: Mapped[UUID] = mapped_column(ForeignKey("audit_runs.id"), nullable=False, index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str | None] = mapped_column(Text)
    repro_steps: Mapped[list[str] | None] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    origin_source: Mapped[str] = mapped_column(String(32), nullable=False, default="audit_test")
    source_stage_key: Mapped[str | None] = mapped_column(String(32))
    evidence_type: Mapped[str | None] = mapped_column(String(64))
    evidence_ref: Mapped[str | None] = mapped_column(String(255))
    finding_fingerprint: Mapped[str | None] = mapped_column(String(128), index=True)
    is_validated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    monitoring_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    certification_blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recommended_monitor_type: Mapped[str | None] = mapped_column(String(64))
    recommended_scope: Mapped[str | None] = mapped_column(String(255))
    recommended_threshold_hint: Mapped[str | None] = mapped_column(String(255))
    is_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    run = relationship("AuditRun", back_populates="findings")
    trace_links = relationship("AuditFindingTrace", back_populates="finding", cascade="all, delete-orphan")
    incident_links = relationship("AuditFindingIncident", back_populates="finding", cascade="all, delete-orphan")
