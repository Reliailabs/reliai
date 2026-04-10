import { getDashboardChanges, getDashboardTriage } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import {
  DashboardView,
  type DashboardChangeRow,
  type DashboardIncidentRow,
  type WeeklyIncidentPoint,
} from "./dashboard-view"

function mapChangeKind(kind: string): "deployment" | "prompt" | "model" {
  if (kind.includes("deploy")) return "deployment"
  if (kind.includes("prompt")) return "prompt"
  return "model"
}

export default async function DashboardPage() {
  const [triage, changeFeed] = await Promise.all([
    getDashboardTriage(),
    getDashboardChanges(),
  ])
  const now = Date.now()

  const openIncidents: DashboardIncidentRow[] = triage.attention.map((item) => ({
    id: item.id,
    title: item.title,
    project: item.project_name,
    metric: "incident",
    severity: item.severity as DashboardIncidentRow["severity"],
    status: item.acknowledged_at ? "acknowledged" : item.status,
    age: formatRelativeTime(item.started_at, now),
  }))

  const changes: DashboardChangeRow[] = changeFeed.changes.map((change) => ({
    id: change.id,
    type: mapChangeKind(change.kind),
    label: change.summary,
    project: change.project_name,
    environment: change.environment ?? "production",
    age: formatRelativeTime(change.created_at, now),
  }))

  const recent = triage.recent_incident_activity
  const weeklyIncidents: WeeklyIncidentPoint[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const next = new Date(date)
    next.setDate(date.getDate() + 1)
    const count = recent.filter((item) => {
      const started = new Date(item.started_at)
      return started >= date && started < next
    }).length
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      count,
    }
  })

  return (
    <DashboardView
      openIncidents={openIncidents}
      unacknowledgedCount={triage.context.unacknowledged_incident_count}
      changes={changes}
      weeklyIncidents={weeklyIncidents}
    />
  )
}
