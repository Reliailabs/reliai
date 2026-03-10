from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import UUID

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

ENVIRONMENT_PRODUCTION = "production"
ENVIRONMENT_STAGING = "staging"
ENVIRONMENT_DEVELOPMENT = "development"
ENVIRONMENT_TYPES = (
    ENVIRONMENT_PRODUCTION,
    ENVIRONMENT_STAGING,
    ENVIRONMENT_DEVELOPMENT,
)


class Environment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "environments"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_environments_project_name"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    type: Mapped[str] = mapped_column(
        Enum(*ENVIRONMENT_TYPES, name="environment_type"),
        nullable=False,
    )

    project = relationship("Project", back_populates="environments")
    traces = relationship("Trace", back_populates="environment_ref")
    incidents = relationship("Incident", back_populates="environment_ref")
    deployments = relationship("Deployment", back_populates="environment_ref")
    guardrail_policies = relationship("GuardrailPolicy", back_populates="environment_ref")
    guardrail_runtime_events = relationship("GuardrailRuntimeEvent", back_populates="environment_ref")
    deployment_simulations = relationship("DeploymentSimulation", back_populates="environment_ref")
    deployment_risk_scores = relationship("DeploymentRiskScore", back_populates="environment_ref")
    trace_ingestion_policies = relationship("TraceIngestionPolicy", back_populates="environment_ref")
    metadata_cardinalities = relationship("MetadataCardinality", back_populates="environment_ref")
