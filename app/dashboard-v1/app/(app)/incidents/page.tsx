import { getIncidents, getProjects } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { IncidentsView, type IncidentRowData } from "./incidents-view"

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const status = Array.isArray(params.status) ? params.status[0] : params.status
  const severity = Array.isArray(params.severity) ? params.severity[0] : params.severity
  const projectId = Array.isArray(params.project_id) ? params.project_id[0] : params.project_id
  const environment = Array.isArray(params.environment) ? params.environment[0] : params.environment
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

  const [data, projects] = await Promise.all([
    getIncidents({
      status: status || undefined,
      severity: severity || undefined,
      project_id: projectId || undefined,
      environment: environment || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    }),
    getProjects(),
  ])
  const now = Date.now()

  const incidents: IncidentRowData[] = data.items.map((item) => {
    const metricName =
      typeof item.summary_json?.metric_name === "string"
        ? item.summary_json.metric_name
        : item.incident_type

    return {
      id: item.id,
      title: item.title,
      status: item.status,
      severity: item.severity,
      project: item.project_name,
      metric: metricName,
      age: formatRelativeTime(item.started_at, now),
      owner: item.owner_operator_email ?? item.acknowledged_by_operator_email,
      acknowledged: Boolean(item.acknowledged_at),
    }
  })

  return (
    <IncidentsView
      incidents={incidents}
      projects={projects.items.map((project) => ({ id: project.id, name: project.name }))}
      filters={{
        status: status || "",
        severity: severity || "",
        projectId: projectId || "",
        environment: environment || "",
        limit: Number.isFinite(limit) && limit ? limit : 25,
      }}
    />
  )
}
