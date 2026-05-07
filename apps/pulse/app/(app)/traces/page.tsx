import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getTracesSurfaceData } from "@/lib/traces-data";

export default async function TracesPage() {
  const tracesData = await getTracesSurfaceData();
  return <DashboardShell initialSection="traces" tracesData={tracesData} />;
}
