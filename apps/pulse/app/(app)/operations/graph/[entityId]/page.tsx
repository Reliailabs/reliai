import { notFound } from "next/navigation";

import { OperationsGraphSurface } from "@/components/operations/operations-graph-surface";
import { getOperationsGraphSurfaceData } from "@/lib/operations-graph-data";

type OperationsGraphPageProps = {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function OperationsGraphPage({ params, searchParams }: OperationsGraphPageProps) {
  const { entityId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const data = await getOperationsGraphSurfaceData(entityId, projectIdParam);
  if (data.nodes.length === 0 && data.edges.length === 0) {
    notFound();
  }
  return <OperationsGraphSurface data={data} />;
}
