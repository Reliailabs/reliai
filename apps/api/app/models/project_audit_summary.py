from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProjectAuditSummary(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_audit_summaries"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "project_id",
            name="uq_project_audit_summaries_org_project",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    latest_audit_id: Mapped[UUID | None] = mapped_column(ForeignKey("audits.id"), index=True)
    latest_audit_run_id: Mapped[UUID | None] = mapped_column(ForeignKey("audit_runs.id"), index=True)
    certification_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    audit_risk_score: Mapped[float | None] = mapped_column(nullable=True)
    audit_risk_level: Mapped[str | None] = mapped_column(String(16))
    open_critical_findings_count: Mapped[int] = mapped_column(nullable=False, default=0)
    open_blocking_findings_count: Mapped[int] = mapped_column(nullable=False, default=0)
    latest_audit_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    certification_at_risk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    certification_risk_reason: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="audit_summary")
    latest_audit = relationship("Audit")
    latest_audit_run = relationship("AuditRun")
