import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getTracesSurfaceData } from "@/lib/traces-data";

type TraceGraphPageProps = {
  params: Promise<{ traceId: string }>;
};

export default async function TraceGraphPage({ params }: TraceGraphPageProps) {
  const { traceId } = await params;
  const tracesData = await getTracesSurfaceData();

  return (
    <DashboardShell
      initialSection="traces"
      tracesData={tracesData}
      traceContext={{ selectedTraceId: traceId, mode: "graph" }}
    />
  );
}
