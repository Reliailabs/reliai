import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAttributionSuggestionsData } from "@/lib/attribution-suggestions-data";
import { requireOperatorSession } from "@/lib/auth";
import { getCausalityEvidenceData } from "@/lib/causality-evidence-data";
import { getPulseOverviewData } from "@/lib/pulse-data";

type ProjectOverviewPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const { projectId } = await params;
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;

  const [pulseOverviewData, causalityEvidenceData, attributionSuggestionsData] = await Promise.all([
    getPulseOverviewData({ demoMode: false, organizationId }),
    getCausalityEvidenceData({ demoMode: false, organizationId }),
    getAttributionSuggestionsData({ demoMode: false, organizationId }),
  ]);

  return (
    <DashboardShell
      initialSection="overview"
      pulseOverviewData={pulseOverviewData}
      causalityEvidenceData={causalityEvidenceData}
      attributionSuggestionsData={attributionSuggestionsData}
      projectContext={{ projectId, mode: "overview" }}
    />
  );
}
