import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getIncidentsSurfaceData } from "@/lib/incidents-data";

export default async function IncidentsPage() {
  const incidentsData = await getIncidentsSurfaceData();
  return <DashboardShell initialSection="incidents" incidentsData={incidentsData} />;
}
