import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";

export default async function AuditsPage() {
  const auditsData = await getAuditsSurfaceData();
  return <DashboardShell initialSection="audits" auditsData={auditsData} />;
}
