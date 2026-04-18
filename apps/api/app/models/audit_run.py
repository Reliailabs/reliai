from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_runs"

    audit_id: Mapped[UUID] = mapped_column(ForeignKey("audits.id"), nullable=False, index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    current_stage_key: Mapped[str] = mapped_column(String(32), nullable=False, default="scoping")
    risk_score: Mapped[float | None] = mapped_column(nullable=True)
    certification_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    certification_effective_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    evidence_window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    evidence_window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    production_snapshot_metadata: Mapped[dict | None] = mapped_column(JSON)
    snapshot_description: Mapped[str | None] = mapped_column(Text)
    snapshot_use_cases: Mapped[list[str] | None] = mapped_column(JSON)
    snapshot_workflow_summary: Mapped[str | None] = mapped_column(Text)
    snapshot_endpoints_notes: Mapped[str | None] = mapped_column(Text)
    snapshot_risk_focus_areas: Mapped[list[str] | None] = mapped_column(JSON)
    snapshot_target_system_name: Mapped[str | None] = mapped_column(String(255))
    snapshot_environment: Mapped[str | None] = mapped_column(String(64))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    audit = relationship("Audit", back_populates="runs")
    stages = relationship("AuditStage", back_populates="run", cascade="all, delete-orphan")
    findings = relationship("AuditFinding", back_populates="run", cascade="all, delete-orphan")
    artifacts = relationship("AuditArtifact", back_populates="run", cascade="all, delete-orphan")
