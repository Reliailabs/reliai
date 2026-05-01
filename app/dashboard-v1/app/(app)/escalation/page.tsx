import { requireOperatorSession } from "@/lib/auth";
import { getOrgEscalationPolicies } from "@/lib/api";
import { EscalationView, type EscalationPolicy } from "./escalation-view";

export default async function EscalationPage() {
  const session = await requireOperatorSession();
  const orgId =
    session.active_organization_id ?? session.memberships[0]?.organization_id;

  const policiesResponse = orgId
    ? await getOrgEscalationPolicies(orgId).catch(() => ({ items: [] }))
    : { items: [] };

  const policies: EscalationPolicy[] = policiesResponse.items.map((policy) => ({
    id: policy.id,
    name: policy.name,
    description: policy.description ?? "—",
    trigger: {
      severity: policy.trigger_severity,
      unacknowledgedAfter: policy.unacknowledged_after_minutes,
    },
    steps: policy.steps.map((step) => ({
      step: step.step_number,
      delay: step.delay_minutes,
      action: step.action,
      target: step.target,
      channel: step.channel,
    })),
    activeIncidents: policy.active_incident_count,
    enabled: policy.enabled,
  }));

  return <EscalationView policies={policies} />;
}
