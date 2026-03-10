from sqlalchemy import Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import UUID

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TraceIngestionPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trace_ingestion_policies"
    __table_args__ = (
        UniqueConstraint("project_id", "environment_id", name="uq_trace_ingestion_policies_scope"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    environment_id: Mapped[UUID | None] = mapped_column(ForeignKey("environments.id"), index=True)
    sampling_success_rate: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    sampling_error_rate: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    max_metadata_fields: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    max_cardinality_per_field: Mapped[int] = mapped_column(Integer, nullable=False, default=250)
    retention_days_success: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    retention_days_error: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    project = relationship("Project", back_populates="trace_ingestion_policies")
    environment_ref = relationship("Environment", back_populates="trace_ingestion_policies")
