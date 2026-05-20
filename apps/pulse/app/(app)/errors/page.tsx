import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getErrorsSurfaceData } from "@/lib/errors-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type ErrorsPageProps = {
  searchParams: Promise<{ project_id?: string }>;
};

export default async function ErrorsPage({ searchParams }: ErrorsPageProps) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const errorsData = await getErrorsSurfaceData(selectedProjectId ?? undefined);
  return (
    <DashboardShell
      initialSection="errors"
      errorsData={errorsData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
