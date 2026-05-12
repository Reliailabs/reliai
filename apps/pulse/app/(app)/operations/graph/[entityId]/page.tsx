import { notFound } from "next/navigation";

import { OperationsGraphSurface } from "@/components/operations/operations-graph-surface";
import { getOperationsGraphSurfaceData } from "@/lib/operations-graph-data";

type OperationsGraphPageProps = {
  params: Promise<{ entityId: string }>;
};

export default async function OperationsGraphPage({ params }: OperationsGraphPageProps) {
  const { entityId } = await params;
  const data = await getOperationsGraphSurfaceData(entityId);
  if (data.nodes.length === 0 && data.edges.length === 0) {
    notFound();
  }
  return <OperationsGraphSurface data={data} />;
}
