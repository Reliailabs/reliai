import { redirect } from "next/navigation";

export default async function IncidentCommandCompatPage({
  params,
  searchParams,
}: {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { incidentId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const scopeQuery = projectIdParam ? `?project_id=${encodeURIComponent(projectIdParam)}` : "";
  redirect(`/incidents/${incidentId}${scopeQuery}`);
}
