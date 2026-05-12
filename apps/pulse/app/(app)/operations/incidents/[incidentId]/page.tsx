import { IncidentOperationsSurface } from "@/components/operations/incident-operations-surface";
import { getIncidentOperationsSurfaceData } from "@/lib/incident-operations-data";

type IncidentOperationsDetailPageProps = {
  params: Promise<{ incidentId: string }>;
};

export default async function IncidentOperationsDetailPage({ params }: IncidentOperationsDetailPageProps) {
  const { incidentId } = await params;
  const data = await getIncidentOperationsSurfaceData(incidentId);
  return <IncidentOperationsSurface data={data} />;
}
