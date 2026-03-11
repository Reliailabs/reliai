from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ReliabilityGraphNode(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reliability_graph_nodes"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "project_id",
            "node_type",
            "node_key",
            name="uq_reliability_graph_nodes_scope_key",
        ),
        Index("ix_reliability_graph_nodes_type_key", "node_type", "node_key"),
        Index("ix_reliability_graph_nodes_trace_count", "trace_count"),
    )

    organization_id: Mapped[UUID | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    node_type: Mapped[str] = mapped_column(String(64), nullable=False)
    node_key: Mapped[str] = mapped_column(String(255), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trace_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    outgoing_edges = relationship(
        "ReliabilityGraphEdge",
        foreign_keys="ReliabilityGraphEdge.source_id",
        back_populates="source",
    )
    incoming_edges = relationship(
        "ReliabilityGraphEdge",
        foreign_keys="ReliabilityGraphEdge.target_id",
        back_populates="target",
    )
