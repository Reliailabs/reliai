from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Audit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audits"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_system_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255))
    audit_type: Mapped[str] = mapped_column(String(64), nullable=False)
    policy_profile: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    use_cases: Mapped[list[str] | None] = mapped_column(JSON)
    workflow_summary: Mapped[str | None] = mapped_column(Text)
    endpoints_notes: Mapped[str | None] = mapped_column(Text)
    risk_focus_areas: Mapped[list[str] | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    project_id: Mapped[UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    environment: Mapped[str | None] = mapped_column(String(64))
    linked_production_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    evidence_window_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    include_incidents: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_trace_samples: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_guardrail_violations: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_regressions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_model_changes: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="audits")
    runs = relationship("AuditRun", back_populates="audit", cascade="all, delete-orphan")
