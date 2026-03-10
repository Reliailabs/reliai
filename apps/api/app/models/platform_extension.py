from uuid import UUID

from sqlalchemy import ForeignKey, String
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

    organization = relationship("Organization", back_populates="platform_extensions")
    project = relationship("Project")
    processor = relationship("ExternalProcessor")
