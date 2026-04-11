import {
  getOrganizationPolicies,
  getProject,
  getProjectReliability,
  getProjectGuardrailMetrics,
  getProjectCost,
  getProjectTimeline,
  getProjectModelVersions,
  getIncidents,
} from "@/lib/api"
import type { OrganizationGuardrailPolicyRead } from "@reliai/types"
import { requireOperatorSession } from "@/lib/auth"
import { formatRelativeTime } from "@/lib/time"
import { ProjectDetailView, type GuardrailPolicyRow, type ProjectIncidentRow } from "./project-detail-view"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireOperatorSession()
  const project = await getProject(id)
  const orgId = session.active_organization_id ?? project.organization_id
  const now = Date.now()

  const [
    policiesResponse,
    reliability,
    incidentsResponse,
    guardrailMetrics,
    cost,
    timeline,
    modelVersions,
  ] = await Promise.all([
    getOrganizationPolicies(orgId),
    getProjectReliability(id).catch(() => null),
    getIncidents({ project_id: id, status: "open", limit: 25 }).catch(() => ({ items: [] as never[] })),
    getProjectGuardrailMetrics(id).catch(() => null),
    getProjectCost(id).catch(() => null),
    getProjectTimeline(id).catch(() => null),
    getProjectModelVersions(id).catch(() => null),
  ])

  const guardrailPolicies: GuardrailPolicyRow[] = policiesResponse.items.map((policy: OrganizationGuardrailPolicyRead) => ({
    id: policy.id,
    name: policy.policy_type.replace(/_/g, " "),
    type: policy.policy_type,
    threshold: policy.enforcement_mode,
    enabled: policy.enabled,
    actionsLast24h: 0,
    truePositives: 0,
    falsePositives: 0,
  }))

  const openIncidents: ProjectIncidentRow[] = (incidentsResponse as { items: { id: string; title: string; severity: string; started_at: string }[] }).items.map(
    (inc) => ({
      id: inc.id,
      title: inc.title,
      severity: inc.severity as ProjectIncidentRow["severity"],
      age: formatRelativeTime(inc.started_at, now),
    }),
  )

  return (
    <ProjectDetailView
      project={{
        id: project.id,
        name: project.name,
        env: project.environment,
        model: "—",   // ProjectRead has no model field
        errorRate: reliability?.quality_pass_rate != null
          ? Math.round((1 - reliability.quality_pass_rate) * 1000) / 10
          : 0,
        p95Latency: reliability?.detection_latency_p90 ?? 0,
        tracesPerDay: "—",   // no traces/day endpoint yet (T3 scope)
      }}
      guardrailPolicies={guardrailPolicies}
      openIncidents={openIncidents}
      guardrailMetrics={guardrailMetrics}
      cost={cost}
      timeline={timeline}
      modelVersions={modelVersions}
    />
  )
}
