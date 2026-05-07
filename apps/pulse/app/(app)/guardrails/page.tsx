import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getGuardrailsSurfaceData } from "@/lib/guardrails-data";

export default async function GuardrailsPage() {
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const guardrailsData = await getGuardrailsSurfaceData(organizationId);
  return <DashboardShell initialSection="guardrails" guardrailsData={guardrailsData} />;
}
