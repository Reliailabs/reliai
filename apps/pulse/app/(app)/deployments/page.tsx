import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDeploymentsSurfaceData } from "@/lib/deployments-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type DeploymentsPageProps = {
  searchParams: Promise<{ project_id?: string }>;
};

export default async function DeploymentsPage({ searchParams }: DeploymentsPageProps) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const deploymentsData = await getDeploymentsSurfaceData(selectedProjectId);
  return (
    <DashboardShell
      initialSection="deployments"
      deploymentsData={deploymentsData}
      deploymentContext={{ selectedDeploymentId: null, mode: "list" }}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
