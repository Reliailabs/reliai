from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PromptVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "prompt_versions"
    __table_args__ = (
        UniqueConstraint("project_id", "version", name="uq_prompt_versions_project_version"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(120), nullable=False)
    label: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="prompt_versions")
    traces = relationship("Trace", back_populates="prompt_version_record")
    deployments = relationship("Deployment", back_populates="prompt_version")
