from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Trace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "traces"
    __table_args__ = (
        Index("ix_traces_project_created_at_desc", "project_id", "created_at"),
        Index("ix_traces_organization_created_at", "organization_id", "created_at"),
        Index("ix_traces_prompt_version_record_created_at_desc", "prompt_version_record_id", "created_at"),
        Index("ix_traces_model_version_record_created_at_desc", "model_version_record_id", "created_at"),
        Index("ix_traces_project_prompt_version_created_at", "project_id", "prompt_version", "created_at"),
        Index("ix_traces_project_model_name_created_at", "project_id", "model_name", "created_at"),
        Index("ix_traces_project_request_id", "project_id", "request_id"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    prompt_version_record_id: Mapped[UUID | None] = mapped_column(ForeignKey("prompt_versions.id"), index=True)
    model_version_record_id: Mapped[UUID | None] = mapped_column(ForeignKey("model_versions.id"), index=True)
    environment: Mapped[str] = mapped_column(String(32), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    request_id: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(255))
    session_id: Mapped[str | None] = mapped_column(String(255))
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_provider: Mapped[str | None] = mapped_column(String(120))
    prompt_version: Mapped[str | None] = mapped_column(String(120))
    input_text: Mapped[str | None] = mapped_column(Text)
    output_text: Mapped[str | None] = mapped_column(Text)
    input_preview: Mapped[str | None] = mapped_column(Text)
    output_preview: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    total_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    is_explainable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_type: Mapped[str | None] = mapped_column(String(120))
    metadata_json: Mapped[dict | None] = mapped_column(JSON)

    project = relationship("Project", back_populates="traces")
    prompt_version_record = relationship("PromptVersion", back_populates="traces")
    model_version_record = relationship("ModelVersion", back_populates="traces")
    retrieval_span = relationship("RetrievalSpan", back_populates="trace", uselist=False)
    evaluations = relationship("Evaluation", back_populates="trace")
    graph_evaluations = relationship("TraceEvaluation", back_populates="trace")
    graph_retrieval_span = relationship("TraceRetrievalSpan", back_populates="trace", uselist=False)
