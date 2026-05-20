import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getIncidentsSurfaceData } from "@/lib/incidents-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type IncidentDetailPageProps = {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function IncidentDetailPage({ params, searchParams }: IncidentDetailPageProps) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const incidentsData = await getIncidentsSurfaceData(selectedProjectId);

  return (
    <DashboardShell
      initialSection="incidents"
      incidentsData={incidentsData}
      incidentContext={{ selectedIncidentId: incidentId }}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
