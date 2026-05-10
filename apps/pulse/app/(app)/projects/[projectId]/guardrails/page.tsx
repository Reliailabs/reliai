import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getGuardrailsSurfaceData } from "@/lib/guardrails-data";

type ProjectGuardrailsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectGuardrailsPage({ params }: ProjectGuardrailsPageProps) {
  const { projectId } = await params;
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const guardrailsData = await getGuardrailsSurfaceData(organizationId, projectId);

  return (
    <DashboardShell
      initialSection="guardrails"
      guardrailsData={guardrailsData}
      projectContext={{ projectId, mode: "guardrails" }}
    />
  );
}
