import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";

type AuditDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuditDetailPage({ params }: AuditDetailPageProps) {
  const { id } = await params;
  const auditsData = await getAuditsSurfaceData();

  return (
    <DashboardShell
      initialSection="audits"
      auditsData={auditsData}
      auditContext={{ selectedAuditId: id, mode: "detail" }}
    />
  );
}
