import { IncidentOperationsSurface } from "@/components/operations/incident-operations-surface";
import { getIncidentOperationsSurfaceData } from "@/lib/incident-operations-data";
import { notFound } from "next/navigation";

type IncidentOperationsDetailPageProps = {
  params: Promise<{ incidentId: string }>;
};

export default async function IncidentOperationsDetailPage({ params }: IncidentOperationsDetailPageProps) {
  const { incidentId } = await params;
  const data = await getIncidentOperationsSurfaceData(incidentId);
  if (!data.incident && data.timelineEntries.length === 0 && data.proposals.length === 0) {
    notFound();
  }
  return <IncidentOperationsSurface data={data} />;
}
