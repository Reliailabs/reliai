import { requireOperatorSession } from "@/lib/auth";
import { getProjects, getProjectSLOs } from "@/lib/api";
import { SLOsView, type SLOEntry } from "./slos-view";

const PERIOD_TO_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export default async function SLOsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  await requireOperatorSession();

  const resolved = await searchParams;
  const period = resolved?.period ?? "30d";
  const windowDays = PERIOD_TO_DAYS[period] ?? 30;

  const { items: projects } = await getProjects();

  const projectSLOs = await Promise.all(
    projects.map((p) =>
      getProjectSLOs(p.id, { window_days: windowDays }).catch(() => ({ items: [] }))
    ),
  );

  const slos: SLOEntry[] = projectSLOs.flatMap((response, index) => {
    const project = projects[index];
    return response.items.map((slo) => ({
      id: slo.id,
      name: slo.name,
      description: slo.description ?? "—",
      current: slo.current_value,
      target: slo.target_value,
      unit: "%",
      status: slo.status,
      trend: slo.trend,
      projectId: project.id,
      projectName: project.name,
      windowDays: slo.window_days,
    }));
  });

  return (
    <SLOsView
      slos={slos}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      period={period}
    />
  );
}
