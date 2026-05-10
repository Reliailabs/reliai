import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDeploymentsSurfaceData } from "@/lib/deployments-data";

type DeploymentDetailPageProps = {
  params: Promise<{ deploymentId: string }>;
};

export default async function DeploymentDetailPage({ params }: DeploymentDetailPageProps) {
  const { deploymentId } = await params;
  const deploymentsData = await getDeploymentsSurfaceData();

  return (
    <DashboardShell
      initialSection="deployments"
      deploymentsData={deploymentsData}
      deploymentContext={{ selectedDeploymentId: deploymentId, mode: "detail" }}
    />
  );
}
