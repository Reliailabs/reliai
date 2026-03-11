import { getProject, getProjectReliabilityControlPanel } from "@/lib/api";
import { ControlPanelView } from "@/components/presenters/control-panel-view";

export default async function ProjectControlPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, panel] = await Promise.all([
    getProject(projectId),
    getProjectReliabilityControlPanel(projectId, environment),
  ]);

  return (
    <ControlPanelView
      projectId={projectId}
      projectName={project.name}
      panel={panel}
      environment={environment}
    />
  );
}
