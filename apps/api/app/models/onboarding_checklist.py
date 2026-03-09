from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OnboardingChecklist(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "onboarding_checklists"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, unique=True, index=True
    )
    project_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    api_key_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_trace_ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization = relationship("Organization", back_populates="onboarding_checklist")
