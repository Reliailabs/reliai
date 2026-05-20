import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getGuardrailsSurfaceData } from "@/lib/guardrails-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

export default async function GuardrailsPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const guardrailsData = await getGuardrailsSurfaceData(organizationId, selectedProjectId ?? undefined);
  return (
    <DashboardShell
      initialSection="guardrails"
      guardrailsData={guardrailsData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
