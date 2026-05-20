import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";
import { getPostmortemsSurfaceData } from "@/lib/postmortems-data";

export default async function PostmortemsPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const postmortemsData = await getPostmortemsSurfaceData(selectedProjectId ?? undefined);
  return (
    <DashboardShell
      initialSection="postmortems"
      postmortemsData={postmortemsData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
