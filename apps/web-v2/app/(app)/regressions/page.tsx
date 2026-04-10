import { getProjectRegressions, getProjects } from "@/lib/api"
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

  const regressions: RegressionRowData[] = responses
    .flatMap((response) => response.items.map((item) => ({ item, projectId: response.projectId })))
    .sort((a, b) => new Date(b.item.detected_at).getTime() - new Date(a.item.detected_at).getTime())
    .map((entry, index) => {
      const regression = entry.item
      const deltaPercent = regression.delta_percent ? Number.parseFloat(regression.delta_percent) : 0
      const sparklineBase = [1, 1.2, 1.4, 1.1, 1.3, 1.5, 1.2].map((value) => ({
        value: value + index * 0.02,
      }))

      return {
        id: regression.id,
        name: regression.metric_name,
        project: projectMap.get(entry.projectId) ?? regression.project_id,
        metric: regression.metric_name,
        baselineValue: regression.baseline_value,
        currentValue: regression.current_value,
        deltaPercent,
        status: "active",
        severity: "medium",
        sparkline: sparklineBase,
        detectedAt: formatRelativeTime(regression.detected_at, now),
        baselineVersion: "—",
        promptVersion: "—",
        model: "—",
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
