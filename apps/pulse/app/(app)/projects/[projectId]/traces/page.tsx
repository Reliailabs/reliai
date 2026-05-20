import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getTracesSurfaceData } from "@/lib/traces-data";

type ProjectTracesPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectTracesPage({ params }: ProjectTracesPageProps) {
  const { projectId } = await params;
  const tracesData = await getTracesSurfaceData(projectId);

  return (
    <DashboardShell
      initialSection="traces"
      tracesData={tracesData}
      projectContext={{ projectId, mode: "traces" }}
      traceContext={{ selectedTraceId: null, mode: "list" }}
    />
  );
}
