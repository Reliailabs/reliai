import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAttributionSuggestionsData } from "@/lib/attribution-suggestions-data";
import { requireOperatorSession } from "@/lib/auth";
import { getCausalityEvidenceData } from "@/lib/causality-evidence-data";
import { getPulseOverviewData } from "@/lib/pulse-data";
import { getProjectControlParityData } from "@/lib/project-control-data";

type ProjectOverviewPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const { projectId } = await params;
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;

  const [pulseOverviewData, causalityEvidenceData, attributionSuggestionsData, projectControlData] = await Promise.all([
    getPulseOverviewData({ demoMode: false, organizationId, projectId }),
    getCausalityEvidenceData({ demoMode: false, organizationId, projectId }),
    getAttributionSuggestionsData({ demoMode: false, organizationId, projectId }),
    getProjectControlParityData(projectId),
  ]);

  return (
    <DashboardShell
      initialSection="overview"
      pulseOverviewData={pulseOverviewData}
      causalityEvidenceData={causalityEvidenceData}
      attributionSuggestionsData={attributionSuggestionsData}
      projectContext={{ projectId, mode: "overview" }}
      projectControlData={projectControlData}
    />
  );
}
