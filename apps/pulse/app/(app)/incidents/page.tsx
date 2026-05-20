import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getIncidentsSurfaceData } from "@/lib/incidents-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const incidentsData = await getIncidentsSurfaceData(selectedProjectId);
  return (
    <DashboardShell
      initialSection="incidents"
      incidentsData={incidentsData}
      incidentContext={{ selectedIncidentId: null }}
      projectScope={{
        selectedProjectId,
        projects: projects.map((project) => ({ id: project.id, name: project.name })),
      }}
    />
  );
}
