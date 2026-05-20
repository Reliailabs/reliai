import { IncidentOperationsSurface } from "@/components/operations/incident-operations-surface";
import { getIncidentOperationsSurfaceData } from "@/lib/incident-operations-data";
import { notFound } from "next/navigation";

type IncidentOperationsDetailPageProps = {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function IncidentOperationsDetailPage({ params, searchParams }: IncidentOperationsDetailPageProps) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const data = await getIncidentOperationsSurfaceData(incidentId, { projectId: projectIdParam });
  if (!data.incident && data.timelineEntries.length === 0 && data.proposals.length === 0) {
    notFound();
  }
  return <IncidentOperationsSurface data={data} />;
}
