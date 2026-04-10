import { getProjectReliability, getProjects } from "@/lib/api"
import { ProjectsView, type ProjectCardData } from "./projects-view"

export default async function ProjectsPage() {
  const data = await getProjects()
  const reliability = await Promise.all(
    data.items.map((project) =>
      getProjectReliability(project.id).then((value) => ({ id: project.id, value })).catch(() => ({
        id: project.id,
        value: null,
      }))
    )
  )
  const reliabilityMap = new Map(reliability.map((entry) => [entry.id, entry.value]))

  const projects: ProjectCardData[] = data.items.map((project) => {
    const metrics = reliabilityMap.get(project.id)
    const incidentDensity = metrics?.incident_density ?? null
    const detectionLatency = metrics?.detection_latency_p90 ?? null
    const qualityPassRate = metrics?.quality_pass_rate ?? null
    const incidentsCount = metrics?.recent_incidents?.length ?? 0

    const errorTone =
      incidentDensity !== null && incidentDensity >= 5
        ? "critical"
        : incidentDensity !== null && incidentDensity >= 2
        ? "warning"
        : "stable"
    const latencyTone =
      detectionLatency !== null && detectionLatency >= 2000
        ? "critical"
        : detectionLatency !== null && detectionLatency >= 1000
        ? "warning"
        : "stable"
    const qualityTone =
      qualityPassRate !== null && qualityPassRate < 0.8
        ? "critical"
        : qualityPassRate !== null && qualityPassRate < 0.9
        ? "warning"
        : "stable"

    return {
      id: project.id,
      name: project.name,
      description: project.description ?? "No description provided.",
      status: project.is_active ? "healthy" : "maintenance",
      model: "—",
      version: "—",
      lastDeployed: project.updated_at,
      metrics: {
        errorRate: {
          value: incidentDensity === null ? "—" : incidentDensity.toFixed(2),
          tone: errorTone,
        },
        latency: {
          value: detectionLatency === null ? "—" : `${Math.round(detectionLatency)}ms`,
          tone: latencyTone,
        },
        throughput: { value: "—", tone: "stable" },
        uptime: {
          value: qualityPassRate === null ? "—" : `${Math.round(qualityPassRate * 100)}%`,
          tone: qualityTone,
        },
      },
      alerts: 0,
      incidents: incidentsCount,
    }
  })

  return <ProjectsView projects={projects} />
}
