import { getProjectRegressions, getProjects, getRegressionHistory } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { RegressionsView, type RegressionRowData } from "./regressions-view"

export default async function RegressionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const metricName = Array.isArray(params.metric_name) ? params.metric_name[0] : params.metric_name
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

  const projects = await getProjects()
  const responses = await Promise.all(
    projects.items.map((project) =>
      getProjectRegressions(project.id, {
        metric_name: metricName || undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      }).then((result) => ({ projectId: project.id, items: result.items }))
    )
  )

  const projectMap = new Map(projects.items.map((project) => [project.id, project.name]))
  const now = Date.now()
  const entries = responses.flatMap((response) =>
    response.items.map((item) => ({ item, projectId: response.projectId }))
  )
  const sortedEntries = entries.sort(
    (a, b) => new Date(b.item.detected_at).getTime() - new Date(a.item.detected_at).getTime()
  )
  const histories = await Promise.all(
    sortedEntries.map((entry) =>
      getRegressionHistory(entry.projectId, entry.item.id).catch(() => null)
    )
  )

  const regressions: RegressionRowData[] = sortedEntries.map((entry, index) => {
      const regression = entry.item
      const deltaPercent = regression.delta_percent ? Number.parseFloat(regression.delta_percent) : 0
      const absDelta = Math.abs(deltaPercent)
      const severity: "critical" | "high" | "medium" | "low" =
        absDelta >= 30 ? "critical" : absDelta >= 20 ? "high" : absDelta >= 10 ? "medium" : "low"
      const historyPoints = histories[index]?.points ?? []
      const sparkline = historyPoints
        .map((point) => Number.parseFloat(point.metric_value))
        .filter((value) => Number.isFinite(value))
        .map((value) => ({ value }))

      return {
        id: regression.id,
        name: regression.metric_name,
        project: projectMap.get(entry.projectId) ?? regression.project_id,
        metric: regression.metric_name,
        baselineValue: regression.baseline_value,
        currentValue: regression.current_value,
        deltaPercent,
        status: "active" as const,
        severity,
        sparkline,
        detectedAt: formatRelativeTime(regression.detected_at, now),
        baselineVersion: "—",
        promptVersion: regression.scope_type === "prompt_version" ? regression.scope_id : "—",
        model: "—",
        scopeType: regression.scope_type,
        scopeId: regression.scope_id,
        windowMinutes: regression.window_minutes,
        metadata: regression.metadata_json ?? null,
      }
    })

  return (
    <RegressionsView
      regressions={regressions}
      filters={{
        metricName: metricName || "",
        limit: Number.isFinite(limit) && limit ? limit : 25,
      }}
    />
  )
}
