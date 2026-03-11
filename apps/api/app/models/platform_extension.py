from uuid import UUID

from typing import Any

from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PlatformExtension(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "platform_extensions"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    processor_id: Mapped[UUID] = mapped_column(
        ForeignKey("external_processors.id"), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    processor_type: Mapped[str] = mapped_column(String(64), nullable=False, default="extension")
    version: Mapped[str] = mapped_column(String(64), nullable=False, default="1.0.0")
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    organization = relationship("Organization", back_populates="platform_extensions")
    project = relationship("Project", back_populates="platform_extensions")
    processor = relationship("ExternalProcessor")
