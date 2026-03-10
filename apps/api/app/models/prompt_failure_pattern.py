from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PromptFailurePattern(Base):
    __tablename__ = "prompt_failure_patterns"
    __table_args__ = (
        PrimaryKeyConstraint("prompt_pattern_hash", name="pk_prompt_failure_patterns"),
    )

    prompt_pattern_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    failure_rate: Mapped[float] = mapped_column(Float, nullable=False)
    token_range: Mapped[dict] = mapped_column(JSON, nullable=False)
    model_distribution: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
