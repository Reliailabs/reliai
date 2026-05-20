import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOperationsSurfaceData } from "@/lib/operations-timeline";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type OperationsPageProps = {
  searchParams: Promise<{ project_id?: string }>;
};

export default async function OperationsPage({ searchParams }: OperationsPageProps) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const operationsData = await getOperationsSurfaceData(undefined, {
    filter: selectedProjectId ? { project_id: selectedProjectId } : undefined,
  });
  return (
    <DashboardShell
      initialSection="operations"
      operationsData={operationsData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
