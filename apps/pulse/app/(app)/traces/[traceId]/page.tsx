import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getTracesSurfaceData } from "@/lib/traces-data";

type TraceDetailPageProps = {
  params: Promise<{ traceId: string }>;
};

export default async function TraceDetailPage({ params }: TraceDetailPageProps) {
  const { traceId } = await params;
  const tracesData = await getTracesSurfaceData();

  return (
    <DashboardShell
      initialSection="traces"
      tracesData={tracesData}
      traceContext={{ selectedTraceId: traceId, mode: "detail" }}
    />
  );
}
