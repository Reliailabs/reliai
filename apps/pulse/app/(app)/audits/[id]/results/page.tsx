import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";

type AuditResultsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuditResultsPage({ params }: AuditResultsPageProps) {
  const { id } = await params;
  const auditsData = await getAuditsSurfaceData();

  return (
    <DashboardShell
      initialSection="audits"
      auditsData={auditsData}
      auditContext={{ selectedAuditId: id, mode: "results" }}
    />
  );
}
