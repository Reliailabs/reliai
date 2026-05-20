import { redirect } from "next/navigation";

import { toIncidentOperationsAliasPath } from "@/lib/incident-deeplink-alias";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type IncidentCompareAliasPageProps = {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function IncidentCompareAliasPage({ params, searchParams }: IncidentCompareAliasPageProps) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  redirect(toIncidentOperationsAliasPath(incidentId, "compare", selectedProjectId));
}
