import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAuditsSurfaceData } from "@/lib/audits-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

export default async function NewAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const auditsData = await getAuditsSurfaceData(selectedProjectId);

  return (
    <DashboardShell
      initialSection="audits"
      auditsData={auditsData}
      auditContext={{ selectedAuditId: null, mode: "new" }}
      projectScope={{
        selectedProjectId,
        projects: projects.map((project) => ({ id: project.id, name: project.name })),
      }}
    />
  );
}
