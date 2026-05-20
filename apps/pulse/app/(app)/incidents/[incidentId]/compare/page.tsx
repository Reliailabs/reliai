import { redirect } from "next/navigation";

import { toIncidentOperationsAliasPath } from "@/lib/incident-deeplink-alias";

type IncidentCompareAliasPageProps = {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function IncidentCompareAliasPage({ params, searchParams }: IncidentCompareAliasPageProps) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  redirect(toIncidentOperationsAliasPath(incidentId, "compare", projectIdParam));
}
