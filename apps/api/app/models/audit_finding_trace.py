from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuditFindingTrace(Base):
    __tablename__ = "audit_finding_traces"

    finding_id: Mapped[UUID] = mapped_column(ForeignKey("audit_findings.id"), primary_key=True)
    trace_id: Mapped[UUID] = mapped_column(ForeignKey("traces.id"), primary_key=True)

    finding = relationship("AuditFinding", back_populates="trace_links")
    trace = relationship("Trace")
