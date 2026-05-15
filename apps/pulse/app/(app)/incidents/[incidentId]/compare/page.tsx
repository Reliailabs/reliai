import { redirect } from "next/navigation";

import { toIncidentOperationsAliasPath } from "@/lib/incident-deeplink-alias";

type IncidentCompareAliasPageProps = {
  params: Promise<{ incidentId: string }>;
};

export default async function IncidentCompareAliasPage({ params }: IncidentCompareAliasPageProps) {
  const { incidentId } = await params;
  redirect(toIncidentOperationsAliasPath(incidentId, "compare"));
}
