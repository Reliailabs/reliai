import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type AuditResultsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function AuditResultsPage({ params, searchParams }: AuditResultsPageProps) {
  const { id } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const auditsData = await getAuditsSurfaceData(selectedProjectId);

  return (
    <DashboardShell
      initialSection="audits"
      auditsData={auditsData}
      auditContext={{ selectedAuditId: id, mode: "results" }}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
