import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDeploymentsSurfaceData } from "@/lib/deployments-data";

type ProjectDeploymentsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDeploymentsPage({ params }: ProjectDeploymentsPageProps) {
  const { projectId } = await params;
  const deploymentsData = await getDeploymentsSurfaceData();

  return (
    <DashboardShell
      initialSection="deployments"
      deploymentsData={deploymentsData}
      projectContext={{ projectId, mode: "deployments" }}
      deploymentContext={{ selectedDeploymentId: null, mode: "list" }}
    />
  );
}
