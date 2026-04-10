import { getProjects } from "@/lib/api"
import { ProjectsView, type ProjectCardData } from "./projects-view"

export default async function ProjectsPage() {
  const data = await getProjects()

  const projects: ProjectCardData[] = data.items.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description ?? "No description provided.",
    status: project.is_active ? "healthy" : "maintenance",
    model: "—",
    version: "—",
    lastDeployed: project.updated_at,
    metrics: {
      errorRate:  { value: "—", tone: "stable" },
      latency:    { value: "—", tone: "stable" },
      throughput: { value: "—", tone: "stable" },
      uptime:     { value: "—", tone: "stable" },
    },
    alerts: 0,
    incidents: 0,
  }))

  return <ProjectsView projects={projects} />
}
