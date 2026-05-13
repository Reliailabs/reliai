from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OncallRotation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oncall_rotations"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_oncall_rotations_project_name"),
    )

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="Primary Rotation")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    organization = relationship("Organization")
    project = relationship("Project", back_populates="oncall_rotations")
    assignments = relationship("OncallAssignment", back_populates="rotation", cascade="all, delete-orphan")
    escalation_policy_steps = relationship(
        "OncallEscalationPolicy",
        back_populates="rotation",
        cascade="all, delete-orphan",
    )
