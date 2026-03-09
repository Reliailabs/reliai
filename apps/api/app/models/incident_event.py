from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class IncidentEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "incident_events"
    __table_args__ = (
        Index("ix_incident_events_incident_created_at", "incident_id", "created_at"),
        Index("ix_incident_events_type_created_at", "event_type", "created_at"),
    )

    incident_id: Mapped[UUID] = mapped_column(ForeignKey("incidents.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_operator_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("operator_users.id"))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    incident = relationship("Incident", back_populates="events")
    actor_operator_user = relationship("OperatorUser", back_populates="incident_events")
