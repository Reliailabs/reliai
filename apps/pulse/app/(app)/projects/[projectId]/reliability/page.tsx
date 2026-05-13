import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getGuardrailsSurfaceData } from "@/lib/guardrails-data";
import { getProjectControlParityData } from "@/lib/project-control-data";

type ProjectReliabilityPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectReliabilityPage({ params }: ProjectReliabilityPageProps) {
  const { projectId } = await params;
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;

  const [guardrailsData, projectControlData] = await Promise.all([
    getGuardrailsSurfaceData(organizationId, projectId),
    getProjectControlParityData(projectId),
  ]);

  return (
    <DashboardShell
      initialSection="guardrails"
      guardrailsData={guardrailsData}
      projectContext={{ projectId, mode: "reliability" }}
      projectControlData={projectControlData}
    />
  );
}
