import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAttributionSuggestionsData } from "@/lib/attribution-suggestions-data";
import { requireOperatorSession } from "@/lib/auth";
import { getCausalityEvidenceData } from "@/lib/causality-evidence-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";
import { getPulseOverviewData } from "@/lib/pulse-data";

export default async function PulseDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const demoParam = Array.isArray(params.demo) ? params.demo[0] : params.demo;
  const projectIdParam = Array.isArray(params.project_id) ? params.project_id[0] : params.project_id;
  const demoMode = demoParam === "1" || demoParam === "true";
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam ?? null);
  const [pulseOverviewData, causalityEvidenceData, attributionSuggestionsData] = await Promise.all([
    getPulseOverviewData({ demoMode, organizationId, projectId: selectedProjectId }),
    getCausalityEvidenceData({ demoMode, organizationId }),
    getAttributionSuggestionsData({ demoMode, organizationId }),
  ]);

  return (
    <DashboardShell
      initialSection="overview"
      pulseOverviewData={pulseOverviewData}
      causalityEvidenceData={causalityEvidenceData}
      attributionSuggestionsData={attributionSuggestionsData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
