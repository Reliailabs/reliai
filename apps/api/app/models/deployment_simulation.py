from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeploymentSimulation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deployment_simulations"
    __table_args__ = (
        Index("ix_deployment_simulations_project_created_at", "project_id", "created_at"),
        Index("ix_deployment_simulations_risk_level_created_at", "risk_level", "created_at"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    environment_id: Mapped[UUID] = mapped_column(ForeignKey("environments.id"), nullable=False, index=True)
    prompt_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("prompt_versions.id"), index=True)
    model_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("model_versions.id"), index=True)
    trace_sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_failure_rate: Mapped[float | None] = mapped_column(Numeric(6, 4))
    predicted_latency_ms: Mapped[float | None] = mapped_column(Numeric(12, 2))
    risk_level: Mapped[str | None] = mapped_column(String(16))
    analysis_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    project = relationship("Project")
    environment_ref = relationship("Environment", back_populates="deployment_simulations")
    prompt_version = relationship("PromptVersion")
    model_version = relationship("ModelVersion")
