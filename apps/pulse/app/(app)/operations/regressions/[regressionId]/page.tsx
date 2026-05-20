import { notFound } from "next/navigation";

import { RegressionOperationsSurface } from "@/components/operations/regression-operations-surface";
import { getRegressionOperationsSurfaceData } from "@/lib/regression-operations-data";

type RegressionOperationsDetailPageProps = {
  params: Promise<{ regressionId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function RegressionOperationsDetailPage({ params, searchParams }: RegressionOperationsDetailPageProps) {
  const { regressionId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const data = await getRegressionOperationsSurfaceData(regressionId, projectIdParam);
  if (!data.regression && data.timelineEntries.length === 0 && data.proposals.length === 0 && data.relatedIncidents.length === 0) {
    notFound();
  }
  return <RegressionOperationsSurface data={data} />;
}
