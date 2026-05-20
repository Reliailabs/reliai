import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";
import { getServicesSurfaceData } from "@/lib/services-data";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const servicesData = await getServicesSurfaceData(selectedProjectId ?? undefined);
  return (
    <DashboardShell
      initialSection="services"
      servicesData={servicesData}
      projectScope={{ projects, selectedProjectId }}
    />
  );
}
