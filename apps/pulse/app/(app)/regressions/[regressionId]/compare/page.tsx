import { redirect } from "next/navigation";

export default async function RegressionCompareShimPage({
  params,
  searchParams,
}: {
  params: Promise<{ regressionId: string }>;
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { regressionId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const scopeQuery = projectIdParam ? `?project_id=${encodeURIComponent(projectIdParam)}` : "";
  redirect(`/operations/regressions/${regressionId}${scopeQuery}`);
}
