import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getCausalityEvidenceData } from "@/lib/causality-evidence-data";
import { getPulseOverviewData } from "@/lib/pulse-data";

export default async function PulseDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const demoParam = Array.isArray(params.demo) ? params.demo[0] : params.demo;
  const demoMode = demoParam === "1" || demoParam === "true";
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const [pulseOverviewData, causalityEvidenceData] = await Promise.all([
    getPulseOverviewData({ demoMode, organizationId }),
    getCausalityEvidenceData({ demoMode, organizationId }),
  ]);

  return (
    <DashboardShell
      initialSection="overview"
      pulseOverviewData={pulseOverviewData}
      causalityEvidenceData={causalityEvidenceData}
    />
  );
}
