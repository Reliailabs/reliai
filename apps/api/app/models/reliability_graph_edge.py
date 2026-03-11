from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ReliabilityGraphEdge(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reliability_graph_edges"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "project_id",
            "source_id",
            "target_id",
            "relationship_type",
            name="uq_reliability_graph_edges_scope_relationship",
        ),
        Index("ix_reliability_graph_edges_source_type", "source_type", "weight"),
        Index("ix_reliability_graph_edges_target_type", "target_type", "confidence"),
        Index("ix_reliability_graph_edges_weight_confidence", "weight", "confidence"),
    )

    organization_id: Mapped[UUID | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[UUID] = mapped_column(ForeignKey("reliability_graph_nodes.id"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[UUID] = mapped_column(ForeignKey("reliability_graph_nodes.id"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(64), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    trace_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    source = relationship("ReliabilityGraphNode", foreign_keys=[source_id], back_populates="outgoing_edges")
    target = relationship("ReliabilityGraphNode", foreign_keys=[target_id], back_populates="incoming_edges")
