import { IncidentOperationsSurface } from "@/components/operations/incident-operations-surface";
import { getIncidentOperationsSurfaceData } from "@/lib/incident-operations-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";
import { notFound } from "next/navigation";

type IncidentOperationsDetailPageProps = {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function IncidentOperationsDetailPage({ params, searchParams }: IncidentOperationsDetailPageProps) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const data = await getIncidentOperationsSurfaceData(incidentId, { projectId: selectedProjectId });
  if (!data.incident && data.timelineEntries.length === 0 && data.proposals.length === 0) {
    notFound();
  }
  return (
    <IncidentOperationsSurface
      data={data}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
