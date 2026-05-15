import { redirect } from "next/navigation";

import { toIncidentOperationsAliasPath } from "@/lib/incident-deeplink-alias";

type IncidentInvestigateAliasPageProps = {
  params: Promise<{ incidentId: string }>;
};

export default async function IncidentInvestigateAliasPage({ params }: IncidentInvestigateAliasPageProps) {
  const { incidentId } = await params;
  redirect(toIncidentOperationsAliasPath(incidentId, "investigate"));
}
