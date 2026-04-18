from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditArtifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_artifacts"

    audit_run_id: Mapped[UUID] = mapped_column(ForeignKey("audit_runs.id"), nullable=False, index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    artifact_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_ref: Mapped[str | None] = mapped_column(String(255))
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON)
    is_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    run = relationship("AuditRun", back_populates="artifacts")
