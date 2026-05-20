import { redirect } from "next/navigation";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

export default async function IncidentCommandCompatPage({
  params,
  searchParams,
}: {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const scopeQuery = selectedProjectId ? `?project_id=${encodeURIComponent(selectedProjectId)}` : "";
  redirect(`/incidents/${incidentId}${scopeQuery}`);
}
