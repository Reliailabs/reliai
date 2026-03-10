from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class MetadataCardinality(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "metadata_cardinality"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "environment_id",
            "field_name",
            name="uq_metadata_cardinality_scope",
        ),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    environment_id: Mapped[UUID] = mapped_column(ForeignKey("environments.id"), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unique_values_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observed_value_hashes_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="metadata_cardinalities")
    environment_ref = relationship("Environment", back_populates="metadata_cardinalities")
