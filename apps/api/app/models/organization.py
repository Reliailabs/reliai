from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    sso_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    monthly_traces: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    monthly_traces_reported: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    monthly_usage_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    projects = relationship("Project", back_populates="organization")
    members = relationship("OrganizationMember", back_populates="organization")
    onboarding_checklist = relationship(
        "OnboardingChecklist", back_populates="organization", uselist=False
    )
    alert_target = relationship(
        "OrganizationAlertTarget",
        back_populates="organization",
        uselist=False,
    )
    audit_logs = relationship("AuditLog", back_populates="organization")
    config_snapshots = relationship("OrganizationConfigSnapshot", back_populates="organization")
    public_api_keys = relationship("PublicApiKey", back_populates="organization")
    usage_quota = relationship("UsageQuota", back_populates="organization", uselist=False)
    platform_extensions = relationship("PlatformExtension", back_populates="organization")
    organization_guardrail_policies = relationship(
        "OrganizationGuardrailPolicy",
        back_populates="organization",
    )
