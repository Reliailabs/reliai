from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReliabilityRecommendation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reliability_recommendations"
    __table_args__ = (
        Index(
            "ix_reliability_recommendations_project_created_at",
            "project_id",
            "created_at",
        ),
        Index(
            "ix_reliability_recommendations_project_type_created_at",
            "project_id",
            "recommendation_type",
            "created_at",
        ),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    recommendation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(600), nullable=False)
    evidence_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    project = relationship("Project", back_populates="reliability_recommendations")
