from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeploymentRiskScore(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deployment_risk_scores"
    __table_args__ = (
        UniqueConstraint("deployment_id", name="uq_deployment_risk_scores_deployment_id"),
        Index("ix_deployment_risk_scores_created_at", "created_at"),
        Index("ix_deployment_risk_scores_risk_level_created_at", "risk_level", "created_at"),
    )

    deployment_id: Mapped[UUID] = mapped_column(ForeignKey("deployments.id"), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    analysis_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    deployment = relationship("Deployment", back_populates="risk_score")
