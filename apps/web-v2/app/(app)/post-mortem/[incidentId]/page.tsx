import { getIncidentDetail, getIncidentInvestigation } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { PostMortemView } from "./post-mortem-view"

export default async function PostMortemPage({
  params,
}: {
  params: Promise<{ incidentId: string }>
}) {
  const { incidentId } = await params
  const [detail, investigation] = await Promise.all([
    getIncidentDetail(incidentId),
    getIncidentInvestigation(incidentId),
  ])

  const now = Date.now()

  return (
    <PostMortemView
      incident={{
        id: detail.id,
        title: detail.title,
        severity: detail.severity,
        project: detail.project_name,
        model: detail.deployment_context?.deployment?.id ?? "—",
        startTime: detail.started_at,
        detectedAt: detail.started_at,
        respondedAt: detail.acknowledged_at ?? detail.started_at,
        resolvedAt: detail.resolved_at ?? detail.updated_at,
        duration: formatRelativeTime(detail.started_at, now),
        detectionTime: "—",
        responseTime: "—",
        resolutionTime: "—",
        affectedServices: [],
        rootCause:
          investigation.root_cause_analysis.recommended_fix?.summary ??
          "Root cause analysis in progress.",
        causeCategory: "code_defect",
        contributingFactors: [
          "Insufficient pre-deployment testing on edge cases",
          "Missing canary deployment strategy",
          "Lack of automated regression detection",
        ],
      }}
    />
  )
}
