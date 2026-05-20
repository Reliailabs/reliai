import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getTracesSurfaceData } from "@/lib/traces-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const tracesData = await getTracesSurfaceData(selectedProjectId);
  return (
    <DashboardShell
      initialSection="traces"
      tracesData={tracesData}
      traceContext={{ selectedTraceId: null, mode: "list" }}
      projectScope={{
        selectedProjectId,
        projects: projects.map((project) => ({ id: project.id, name: project.name })),
      }}
    />
  );
}
