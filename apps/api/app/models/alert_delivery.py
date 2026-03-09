from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AlertDelivery(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "alert_deliveries"
    __table_args__ = (
        Index("ix_alert_deliveries_incident_created_at", "incident_id", "created_at"),
        Index("ix_alert_deliveries_status_created_at", "delivery_status", "created_at"),
    )

    incident_id: Mapped[UUID] = mapped_column(ForeignKey("incidents.id"), nullable=False, index=True)
    channel_type: Mapped[str] = mapped_column(String(32), nullable=False)
    channel_target: Mapped[str] = mapped_column(String(255), nullable=False)
    delivery_status: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(String(2000))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    incident = relationship("Incident", back_populates="alert_deliveries")
