import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDeploymentsSurfaceData } from "@/lib/deployments-data";

export default async function DeploymentsPage() {
  const deploymentsData = await getDeploymentsSurfaceData();
  return <DashboardShell initialSection="deployments" deploymentsData={deploymentsData} />;
}
