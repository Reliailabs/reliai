from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuditFindingIncident(Base):
    __tablename__ = "audit_finding_incidents"

    finding_id: Mapped[UUID] = mapped_column(ForeignKey("audit_findings.id"), primary_key=True)
    incident_id: Mapped[UUID] = mapped_column(ForeignKey("incidents.id"), primary_key=True)

    finding = relationship("AuditFinding", back_populates="incident_links")
    incident = relationship("Incident")
