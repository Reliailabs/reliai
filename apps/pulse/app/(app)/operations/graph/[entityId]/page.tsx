import { notFound } from "next/navigation";

import { OperationsGraphSurface } from "@/components/operations/operations-graph-surface";
import { getOperationsGraphSurfaceData } from "@/lib/operations-graph-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type OperationsGraphPageProps = {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function OperationsGraphPage({ params, searchParams }: OperationsGraphPageProps) {
  const { entityId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const data = await getOperationsGraphSurfaceData(entityId, selectedProjectId);
  if (data.nodes.length === 0 && data.edges.length === 0) {
    notFound();
  }
  return (
    <OperationsGraphSurface
      data={data}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
