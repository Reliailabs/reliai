from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.org_escalation_policy import OrgEscalationPolicy, OrgEscalationPolicyStep
from app.models.organization_alert_target import OrganizationAlertTarget
from app.services.auth import OperatorContext
from app.services.authorization import require_org_role


def list_org_escalation_policies(
    db: Session,
    operator: OperatorContext,
    *,
    organization_id: UUID,
) -> list[OrgEscalationPolicy]:
    require_org_role(operator, organization_id, "viewer")
    return db.scalars(
        select(OrgEscalationPolicy)
        .where(OrgEscalationPolicy.organization_id == organization_id)
        .order_by(OrgEscalationPolicy.created_at)
    ).all()


def count_active_incidents_for_policy(
    db: Session,
    policy: OrgEscalationPolicy,
) -> int:
    statement = select(Incident).where(
        Incident.organization_id == policy.organization_id,
        Incident.status == "open",
    )
    if policy.trigger_severity != "all":
        statement = statement.where(Incident.severity == policy.trigger_severity)
    return len(db.scalars(statement).all())


def seed_default_escalation_policy(
    db: Session,
    *,
    organization_id: UUID,
    alert_target: OrganizationAlertTarget,
) -> None:
    existing = db.scalar(
        select(OrgEscalationPolicy).where(
            OrgEscalationPolicy.organization_id == organization_id
        )
    )
    if existing is not None:
        return
    policy = OrgEscalationPolicy(
        organization_id=organization_id,
        name="Default Alert Policy",
        description=f"Alert notifications via {alert_target.channel_type} to {alert_target.channel_target}",
        trigger_severity="all",
        unacknowledged_after_minutes=0,
        enabled=True,
    )
    db.add(policy)
    db.flush()
    step = OrgEscalationPolicyStep(
        policy_id=policy.id,
        step_number=1,
        delay_minutes=0,
        action="notify",
        channel=alert_target.channel_type,
        target=alert_target.channel_target,
    )
    db.add(step)
    db.commit()
