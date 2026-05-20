import { redirect } from "next/navigation";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

export default async function RegressionCompareShimPage({
  params,
  searchParams,
}: {
  params: Promise<{ regressionId: string }>;
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { regressionId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const scopeQuery = selectedProjectId ? `?project_id=${encodeURIComponent(selectedProjectId)}` : "";
  redirect(`/operations/regressions/${regressionId}${scopeQuery}`);
}
