from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeploymentEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deployment_events"
    __table_args__ = (
        Index("ix_deployment_events_deployment_id_created_at", "deployment_id", "created_at"),
    )

    deployment_id: Mapped[UUID] = mapped_column(ForeignKey("deployments.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    deployment = relationship("Deployment", back_populates="events")
