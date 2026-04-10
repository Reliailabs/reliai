import { getOrganizationPolicies, getProject } from "@/lib/api"
import { requireOperatorSession } from "@/lib/auth"
import { ProjectDetailView, type GuardrailPolicyRow } from "./project-detail-view"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireOperatorSession()
  const project = await getProject(id)
  const orgId = session.active_organization_id ?? project.organization_id

  const policiesResponse = await getOrganizationPolicies(orgId)
  const guardrailPolicies: GuardrailPolicyRow[] = policiesResponse.items.map((policy) => ({
    id: policy.id,
    name: policy.policy_type.replace(/_/g, " "),
    type: policy.policy_type,
    threshold: policy.enforcement_mode,
    enabled: policy.enabled,
    actionsLast24h: 0,
    truePositives: 0,
    falsePositives: 0,
  }))

  return (
    <ProjectDetailView
      project={{
        id: project.id,
        name: project.name,
        env: project.environment,
        model: "—",
        errorRate: 0,
        p95Latency: 0,
        tracesPerDay: "—",
      }}
      guardrailPolicies={guardrailPolicies}
      openIncidents={[]}
    />
  )
}
