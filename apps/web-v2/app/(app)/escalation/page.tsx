import { requireOperatorSession } from "@/lib/auth";
import { getOrganizationAlertTarget, getIncidents } from "@/lib/api";
import { EscalationView, type DerivedPolicy } from "./escalation-view";
import type { OrganizationAlertTargetRead } from "@reliai/types";

const CHANNEL_MAP: Record<string, DerivedPolicy["steps"][number]["channel"]> = {
  slack:     "slack",
  email:     "email",
  pagerduty: "pagerduty",
  webhook:   "webhook",
};

function derivePolicy(
  target: OrganizationAlertTargetRead,
  openIncidentCount: number,
): DerivedPolicy {
  const channel: DerivedPolicy["steps"][number]["channel"] =
    CHANNEL_MAP[target.channel_type] ?? "webhook";

  return {
    id: target.id,
    name: "Default Alert Policy",
    description: `Alert notifications via ${target.channel_type} to ${target.channel_target}`,
    trigger: { severity: "all", unacknowledgedAfter: 0 },
    steps: [
      {
        step: 1,
        delay: 0,
        action: "notify",
        target: target.channel_target,
        channel,
      },
    ],
    activeIncidents: openIncidentCount,
    enabled: target.is_active,
  };
}

export default async function EscalationPage() {
  const session = await requireOperatorSession();
  const orgId =
    session.active_organization_id ?? session.memberships[0]?.organization_id;

  const [alertTarget, incidents] = await Promise.all([
    orgId
      ? getOrganizationAlertTarget(orgId).catch(() => null)
      : Promise.resolve(null),
    getIncidents({ status: "open" }).catch(() => ({ items: [] as never[] })),
  ]);

  const openIncidentCount = (incidents as { items: unknown[] }).items.length;
  const policy = alertTarget
    ? derivePolicy(alertTarget, openIncidentCount)
    : null;

  return <EscalationView policy={policy} />;
}
