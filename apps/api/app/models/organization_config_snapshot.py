from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class OrganizationConfigSnapshot(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "organization_config_snapshots"
    __table_args__ = (
        Index("ix_organization_config_snapshots_org_created_at", "organization_id", "created_at"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    source_trace_id: Mapped[str | None] = mapped_column(String(255))
    reason: Mapped[str | None] = mapped_column(String(255))

    organization = relationship("Organization", back_populates="config_snapshots")
