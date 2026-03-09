from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OrganizationAlertTarget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_alert_targets"
    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_organization_alert_targets_organization_id"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    channel_type: Mapped[str] = mapped_column(String(32), nullable=False)
    channel_target: Mapped[str] = mapped_column(String(255), nullable=False)
    slack_webhook_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="alert_target")
