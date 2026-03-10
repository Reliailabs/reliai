from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProcessorFailure(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "processor_failures"
    __table_args__ = (
        Index("ix_processor_failures_processor_created_at", "external_processor_id", "created_at"),
        Index("ix_processor_failures_project_created_at", "project_id", "created_at"),
    )

    external_processor_id: Mapped[UUID] = mapped_column(
        ForeignKey("external_processors.id"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    last_error: Mapped[str] = mapped_column(Text, nullable=False)

    external_processor = relationship("ExternalProcessor", back_populates="failures")
    project = relationship("Project", back_populates="processor_failures")
