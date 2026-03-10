from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_projects_organization_slug"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    environment: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_trace_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="projects")
    api_keys = relationship("APIKey", back_populates="project")
    traces = relationship("Trace", back_populates="project")
    prompt_versions = relationship("PromptVersion", back_populates="project")
    model_versions = relationship("ModelVersion", back_populates="project")
    evaluations = relationship("Evaluation", back_populates="project")
    evaluation_rollups = relationship("EvaluationRollup", back_populates="project")
    reliability_metrics = relationship("ReliabilityMetric", back_populates="project")
    regression_snapshots = relationship("RegressionSnapshot", back_populates="project")
    incidents = relationship("Incident", back_populates="project")
    deployments = relationship("Deployment", back_populates="project")
    guardrail_policies = relationship("GuardrailPolicy", back_populates="project")
    reliability_recommendations = relationship(
        "ReliabilityRecommendation",
        back_populates="project",
    )
