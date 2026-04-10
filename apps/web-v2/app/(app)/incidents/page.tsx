import { getIncidents } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { IncidentsView, type IncidentRowData } from "./incidents-view"

export default async function IncidentsPage() {
  const data = await getIncidents()
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

  return <IncidentsView incidents={incidents} />
}
