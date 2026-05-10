import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getIncidentsSurfaceData } from "@/lib/incidents-data";

type IncidentDetailPageProps = {
  params: Promise<{ incidentId: string }>;
};

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { incidentId } = await params;
  const incidentsData = await getIncidentsSurfaceData();

  return (
    <DashboardShell
      initialSection="incidents"
      incidentsData={incidentsData}
      incidentContext={{ selectedIncidentId: incidentId }}
    />
  );
}
