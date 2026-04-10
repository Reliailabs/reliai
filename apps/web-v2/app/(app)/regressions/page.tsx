import { getRegressions } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { RegressionsView, type RegressionRowData } from "./regressions-view"

export default async function RegressionsPage() {
  const data = await getRegressions()
  const now = Date.now()

  const regressions: RegressionRowData[] = data.items.map((regression, index) => {
    const deltaPercent = regression.delta_percent ? Number.parseFloat(regression.delta_percent) : 0
    const sparklineBase = [1, 1.2, 1.4, 1.1, 1.3, 1.5, 1.2].map((value) => ({
      value: value + index * 0.02,
    }))

    return {
      id: regression.id,
      name: regression.metric_name,
      project: regression.project_id,
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

  return <RegressionsView regressions={regressions} />
}
