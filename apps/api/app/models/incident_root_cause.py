from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class IncidentRootCause(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "incident_root_causes"
    __table_args__ = (
        Index("ix_incident_root_causes_incident_id", "incident_id"),
    )

    incident_id: Mapped[UUID] = mapped_column(ForeignKey("incidents.id"), nullable=False)
    cause_type: Mapped[str] = mapped_column(String(64), nullable=False)
    cause_id: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 6))
    evidence_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    incident = relationship("Incident", back_populates="root_causes")
