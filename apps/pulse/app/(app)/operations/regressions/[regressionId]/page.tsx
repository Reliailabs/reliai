import { notFound } from "next/navigation";

import { RegressionOperationsSurface } from "@/components/operations/regression-operations-surface";
import { getRegressionOperationsSurfaceData } from "@/lib/regression-operations-data";

type RegressionOperationsDetailPageProps = {
  params: Promise<{ regressionId: string }>;
};

export default async function RegressionOperationsDetailPage({ params }: RegressionOperationsDetailPageProps) {
  const { regressionId } = await params;
  const data = await getRegressionOperationsSurfaceData(regressionId);
  if (!data.regression && data.timelineEntries.length === 0 && data.proposals.length === 0 && data.relatedIncidents.length === 0) {
    notFound();
  }
  return <RegressionOperationsSurface data={data} />;
}
