import { notFound } from "next/navigation";

import { TraceGraphView } from "@/components/presenters/trace-graph-view";
import { getTraceAnalysis, getTraceGraph } from "@/lib/api";

export default async function TraceGraphPage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  const [graph, analysis] = await Promise.all([
    getTraceGraph(traceId).catch(() => null),
    getTraceAnalysis(traceId).catch(() => null),
  ]);

  if (!graph) {
    notFound();
  }

  return <TraceGraphView graph={graph} analysis={analysis} />;
}
