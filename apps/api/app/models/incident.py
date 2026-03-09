from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Incident(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "incidents"
    __table_args__ = (
        UniqueConstraint("fingerprint", name="uq_incidents_fingerprint"),
        Index("ix_incidents_org_status_started_at", "organization_id", "status", "started_at"),
        Index("ix_incidents_project_status_started_at", "project_id", "status", "started_at"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    incident_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(255), nullable=False)
    summary_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project = relationship("Project", back_populates="incidents")
