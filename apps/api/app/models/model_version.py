from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ModelVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "model_versions"
    __table_args__ = (
        UniqueConstraint("project_id", "identity_key", name="uq_model_versions_project_identity_key"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    identity_key: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(120))
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(120))
    model_family: Mapped[str | None] = mapped_column(String(120))
    model_revision: Mapped[str | None] = mapped_column(String(120))
    route_key: Mapped[str | None] = mapped_column(String(120))
    label: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="model_versions")
    traces = relationship("Trace", back_populates="model_version_record")
    deployments = relationship("Deployment", back_populates="model_version")
