from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OrganizationGuardrailPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_guardrail_policies"
    __table_args__ = (
        Index("ix_org_guardrail_policies_org_enabled", "organization_id", "enabled"),
        Index("ix_org_guardrail_policies_type_mode", "policy_type", "enforcement_mode"),
    )

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    policy_type: Mapped[str] = mapped_column(String(64), nullable=False)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    enforcement_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="observe")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    organization = relationship("Organization", back_populates="organization_guardrail_policies")
