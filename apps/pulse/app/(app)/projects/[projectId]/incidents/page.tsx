import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getIncidentsSurfaceData } from "@/lib/incidents-data";

type ProjectIncidentsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectIncidentsPage({ params }: ProjectIncidentsPageProps) {
  const { projectId } = await params;
  const incidentsData = await getIncidentsSurfaceData(projectId);

  return (
    <DashboardShell
      initialSection="incidents"
      incidentsData={incidentsData}
      projectContext={{ projectId, mode: "incidents" }}
      incidentContext={{ selectedIncidentId: null }}
    />
  );
}
