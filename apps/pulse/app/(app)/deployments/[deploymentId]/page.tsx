import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDeploymentsSurfaceData } from "@/lib/deployments-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type DeploymentDetailPageProps = {
  params: Promise<{ deploymentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function DeploymentDetailPage({ params, searchParams }: DeploymentDetailPageProps) {
  const { deploymentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const deploymentsData = await getDeploymentsSurfaceData(selectedProjectId);

  return (
    <DashboardShell
      initialSection="deployments"
      deploymentsData={deploymentsData}
      deploymentContext={{ selectedDeploymentId: deploymentId, mode: "detail" }}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
