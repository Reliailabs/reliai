import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getTracesSurfaceData } from "@/lib/traces-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type TraceComparePageProps = {
  params: Promise<{ traceId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function TraceComparePage({ params, searchParams }: TraceComparePageProps) {
  const { traceId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const tracesData = await getTracesSurfaceData(selectedProjectId);

  return (
    <DashboardShell
      initialSection="traces"
      tracesData={tracesData}
      traceContext={{ selectedTraceId: traceId, mode: "compare" }}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
