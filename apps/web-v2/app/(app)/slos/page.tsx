import { requireOperatorSession } from "@/lib/auth";
import { getProjects, getProjectReliability } from "@/lib/api";
import { SLOsView, type SLOEntry } from "./slos-view";

function deriveStatus(
  current: number,
  target: number,
): "healthy" | "at_risk" | "breached" {
  const ratio = current / target;
  if (ratio >= 1.0) return "healthy";
  if (ratio >= 0.95) return "at_risk";
  return "breached";
}

function statusToTrend(
  status: "healthy" | "at_risk" | "breached",
): "up" | "down" | "flat" {
  if (status === "healthy") return "up";
  if (status === "breached") return "down";
  return "flat";
}

export default async function SLOsPage() {
  await requireOperatorSession();

  const { items: projects } = await getProjects();

  const reliabilities = await Promise.all(
    projects.map((p) => getProjectReliability(p.id).catch(() => null)),
  );

  const slos: SLOEntry[] = [];

  projects.forEach((project, i) => {
    const rel = reliabilities[i];
    if (!rel) return;

    // Quality Pass Rate (0–1 fraction → %, target 95%)
    if (rel.quality_pass_rate !== null) {
      const current = Math.round(rel.quality_pass_rate * 1000) / 10;
      const status = deriveStatus(current, 95);
      slos.push({
        id: `${project.id}-quality`,
        name: "Quality Pass Rate",
        description: "Percentage of traces passing all quality evaluations",
        current,
        target: 95,
        unit: "%",
        status,
        trend: statusToTrend(status),
        projectId: project.id,
        projectName: project.name,
      });
    }

    // Incident-Free Rate (derived from incident_density, target 90%)
    if (rel.incident_density !== null) {
      const current = Math.round((1 - rel.incident_density) * 1000) / 10;
      const status = deriveStatus(current, 90);
      slos.push({
        id: `${project.id}-incident-free`,
        name: "Incident-Free Rate",
        description: "Percentage of time without active reliability incidents",
        current,
        target: 90,
        unit: "%",
        status,
        trend: statusToTrend(status),
        projectId: project.id,
        projectName: project.name,
      });
    }

    // Detection Coverage (0–1 fraction → %, target 80%)
    if (rel.detection_coverage !== null) {
      const current = Math.round(rel.detection_coverage * 1000) / 10;
      const status = deriveStatus(current, 80);
      slos.push({
        id: `${project.id}-detection`,
        name: "Detection Coverage",
        description: "Fraction of issues detected by the reliability platform",
        current,
        target: 80,
        unit: "%",
        status,
        trend: statusToTrend(status),
        projectId: project.id,
        projectName: project.name,
      });
    }
  });

  return (
    <SLOsView
      slos={slos}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
