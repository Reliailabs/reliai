import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";

export default async function NewAuditPage() {
  const auditsData = await getAuditsSurfaceData();

  return (
    <DashboardShell
      initialSection="audits"
      auditsData={auditsData}
      auditContext={{ selectedAuditId: null, mode: "new" }}
    />
  );
}
