import { notFound, redirect } from "next/navigation";

import { RegressionOperationsSurface } from "@/components/operations/regression-operations-surface";
import { getRegressionOperationsSurfaceData } from "@/lib/regression-operations-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveStrictScopedProjectId } from "@/lib/project-scope-utils";

type RegressionOperationsDetailPageProps = {
  params: Promise<{ regressionId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function RegressionOperationsDetailPage({ params, searchParams }: RegressionOperationsDetailPageProps) {
  const { regressionId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveStrictScopedProjectId(projects, projectIdParam);
  if (!selectedProjectId && projects.length > 0) {
    redirect("/operations?error=project_scope_required");
  }
  const data = await getRegressionOperationsSurfaceData(regressionId, selectedProjectId);
  if (!data.regression && data.timelineEntries.length === 0 && data.proposals.length === 0 && data.relatedIncidents.length === 0) {
    notFound();
  }
  return (
    <RegressionOperationsSurface
      data={data}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
