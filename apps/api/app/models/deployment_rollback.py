from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeploymentRollback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deployment_rollbacks"
    __table_args__ = (
        Index("ix_deployment_rollbacks_deployment_id_rolled_back_at", "deployment_id", "rolled_back_at"),
    )

    deployment_id: Mapped[UUID] = mapped_column(ForeignKey("deployments.id"), nullable=False, index=True)
    rollback_reason: Mapped[str] = mapped_column(Text, nullable=False)
    rolled_back_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    deployment = relationship("Deployment", back_populates="rollbacks")
