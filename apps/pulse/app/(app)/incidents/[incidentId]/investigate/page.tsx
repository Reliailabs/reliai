import { redirect } from "next/navigation";

import { toIncidentOperationsAliasPath } from "@/lib/incident-deeplink-alias";

type IncidentInvestigateAliasPageProps = {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function IncidentInvestigateAliasPage({ params, searchParams }: IncidentInvestigateAliasPageProps) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  redirect(toIncidentOperationsAliasPath(incidentId, "investigate", projectIdParam));
}
