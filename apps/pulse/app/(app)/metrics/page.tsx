import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getMetricsSurfaceData } from "@/lib/metrics-data";

export default async function MetricsPage() {
  const errorsData = await getMetricsSurfaceData();
  return <DashboardShell initialSection="metrics" errorsData={errorsData} />;
}
