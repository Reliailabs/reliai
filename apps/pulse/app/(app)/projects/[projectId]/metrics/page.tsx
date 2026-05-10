import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getMetricsSurfaceData } from "@/lib/metrics-data";

type ProjectMetricsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectMetricsPage({ params }: ProjectMetricsPageProps) {
  const { projectId } = await params;
  const errorsData = await getMetricsSurfaceData(projectId);

  return (
    <DashboardShell
      initialSection="metrics"
      errorsData={errorsData}
      projectContext={{ projectId, mode: "metrics" }}
    />
  );
}
