import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";

type ProjectAuditsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectAuditsPage({ params }: ProjectAuditsPageProps) {
  const { projectId } = await params;
  const auditsData = await getAuditsSurfaceData(projectId);

  return (
    <DashboardShell
      initialSection="audits"
      auditsData={auditsData}
      projectContext={{ projectId, mode: "audits" }}
      auditContext={{ selectedAuditId: null, mode: "list" }}
    />
  );
}
