import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getPulseOverviewData } from "@/lib/pulse-data";

export default async function PulseDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const demoMode = params.demo === "1";
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const pulseOverviewData = await getPulseOverviewData({ demoMode, organizationId });

  return <DashboardShell initialSection="overview" pulseOverviewData={pulseOverviewData} />;
}
