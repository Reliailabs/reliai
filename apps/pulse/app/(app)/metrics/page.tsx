import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getMetricsSurfaceData } from "@/lib/metrics-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type MetricsPageProps = {
  searchParams: Promise<{ project_id?: string }>;
};

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const errorsData = await getMetricsSurfaceData(selectedProjectId);
  return (
    <DashboardShell
      initialSection="metrics"
      errorsData={errorsData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
