import { getIncidentDetail, getIncidentInvestigation } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { PostMortemView, type PostMortemCauseCategory } from "./post-mortem-view"

const CAUSE_TYPE_MAP: Record<string, PostMortemCauseCategory> = {
  code_defect:         "code_defect",
  infrastructure:      "infrastructure",
  human_error:         "human_error",
  external_dependency: "external_dependency",
  configuration:       "configuration",
  monitoring:          "monitoring",
  deployment_risk:              "infrastructure",
  deployment_risk_correlation:  "infrastructure",
  regression:                   "code_defect",
  evaluation_failure:           "code_defect",
  guardrail_trigger:            "monitoring",
}

function toCauseCategory(causeType: string): PostMortemCauseCategory {
  return CAUSE_TYPE_MAP[causeType] ?? "other"
}

/** Format elapsed minutes between two ISO timestamps. Returns "—" when data is unavailable. */
function minutesBetween(a: string | null | undefined, b: string | null | undefined): string {
  if (!a || !b) return "—"
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60_000
  if (diff < 0) return "—"
  if (diff < 60) return `${Math.round(diff)}m`
  return `${(diff / 60).toFixed(1)}h`
}

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
  const rankedCauses = investigation.root_cause_analysis.ranked_causes ?? []

  // Derive cause category from the top-ranked cause type
  const topCause = rankedCauses[0]
  const causeCategory = toCauseCategory(topCause?.cause_type ?? "")

  // Contributing factors from ranked causes (up to 4), falling back to labels
  const contributingFactors =
    rankedCauses.length > 0
      ? rankedCauses
          .slice(0, 4)
          .map((c) => c.label ?? c.cause_type)
      : ["Root cause analysis in progress"]

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
        detectionTime: minutesBetween(detail.started_at, detail.acknowledged_at),
        responseTime: minutesBetween(detail.acknowledged_at, detail.resolved_at),
        resolutionTime: minutesBetween(detail.started_at, detail.resolved_at),
        affectedServices: [],
        rootCause:
          investigation.root_cause_analysis.recommended_fix?.summary ??
          "Root cause analysis in progress.",
        causeCategory,
        contributingFactors,
      }}
    />
  )
}
