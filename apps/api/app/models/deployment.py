from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Deployment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deployments"
    __table_args__ = (
        Index("ix_deployments_project_deployed_at_desc", "project_id", "deployed_at"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    prompt_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("prompt_versions.id"), index=True)
    model_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("model_versions.id"), index=True)
    environment: Mapped[str] = mapped_column(String(32), nullable=False)
    deployed_by: Mapped[str | None] = mapped_column(String(255))
    deployed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    project = relationship("Project", back_populates="deployments")
    prompt_version = relationship("PromptVersion", back_populates="deployments")
    model_version = relationship("ModelVersion", back_populates="deployments")
    events = relationship("DeploymentEvent", back_populates="deployment")
    rollbacks = relationship("DeploymentRollback", back_populates="deployment")
    incidents = relationship("Incident", back_populates="deployment")
