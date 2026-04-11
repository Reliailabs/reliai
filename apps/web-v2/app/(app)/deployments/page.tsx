import { getProjectDeployments, getProjects } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { DeploymentsView, type DeploymentRecord, type RiskFactor } from "./deployments-view"

export default async function DeploymentsPage() {
  const { items: projects } = await getProjects()
  const now = Date.now()
  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  // Fan-out: fetch deployments per project (mirrors the regressions pattern)
  const perProject = await Promise.all(
    projects.map((p) => getProjectDeployments(p.id).catch(() => ({ items: [] as never[] }))),
  )
  const allItems = perProject
    .flatMap((r) => (r as { items: ReturnType<typeof r["items"][number]["valueOf"]>[] }).items)

  // Sort newest first
  ;(allItems as { deployed_at: string | null; created_at: string }[]).sort(
    (a, b) =>
      new Date(b.deployed_at ?? b.created_at).getTime() -
      new Date(a.deployed_at ?? a.created_at).getTime(),
  )

  const deployments: DeploymentRecord[] = (allItems as Parameters<typeof mapDeployment>[0][]).map(
    (deployment) => mapDeployment(deployment, projectMap, now),
  )

  return <DeploymentsView deployments={deployments} />
}

type RawDeployment = {
  id: string
  project_id: string
  deployed_at: string | null
  created_at: string
  deployed_by: string | null
  metadata_json: Record<string, unknown> | null
  risk_analysis_json: Record<string, unknown> | null
}

function mapDeployment(
  deployment: RawDeployment,
  projectMap: Map<string, string>,
  now: number,
): DeploymentRecord {
  // Derive status from metadata signals
  let status: "live" | "pending" | "rolled_back" | "failed" = "pending"
  if (deployment.deployed_at) status = "live"
  if (deployment.metadata_json?.rollback === true) status = "rolled_back"
  if (deployment.metadata_json?.failed === true) status = "failed"

  // Derive gate status
  const gateDecision = deployment.metadata_json?.gate_decision
  const gateStatus: "pass" | "fail" | "skipped" | "pending" =
    gateDecision === "pass"
      ? "pass"
      : gateDecision === "fail"
        ? "fail"
        : gateDecision === "skipped"
          ? "skipped"
          : "pending"

  return {
    id: deployment.id,
    name: projectMap.get(deployment.project_id) ?? deployment.project_id.slice(0, 8),
    project: projectMap.get(deployment.project_id) ?? deployment.project_id,
    version:
      typeof deployment.metadata_json?.version === "string"
        ? deployment.metadata_json.version
        : "v—",
    model:
      typeof deployment.metadata_json?.model === "string"
        ? deployment.metadata_json.model
        : "—",
    status,
    gateStatus,
    riskScore:
      typeof deployment.metadata_json?.risk_score === "number"
        ? deployment.metadata_json.risk_score
        : 0,
    riskFactors: Array.isArray(deployment.metadata_json?.risk_factors)
      ? (deployment.metadata_json.risk_factors as RiskFactor[])
      : [],
    age: formatRelativeTime(deployment.deployed_at ?? deployment.created_at, now),
    triggeredBy: deployment.deployed_by,
    commit:
      typeof deployment.metadata_json?.commit === "string"
        ? deployment.metadata_json.commit
        : null,
    baseline:
      typeof deployment.metadata_json?.baseline === "string"
        ? deployment.metadata_json.baseline
        : null,
    evalsPassed: (() => {
      const aj = deployment.risk_analysis_json
      if (!aj) return null
      const failRate = typeof aj.current_evaluation_failure_rate === "number" ? aj.current_evaluation_failure_rate : null
      const count = typeof aj.current_trace_count === "number" ? aj.current_trace_count : null
      if (failRate === null || count === null) return null
      return Math.round((1 - failRate) * count)
    })(),
    evalsTotal: (() => {
      const aj = deployment.risk_analysis_json
      return typeof aj?.current_trace_count === "number" ? aj.current_trace_count : null
    })(),
    guardrailsPassed: (() => {
      const aj = deployment.risk_analysis_json
      if (!aj) return null
      const validityRate = typeof aj.current_structured_validity_rate === "number" ? aj.current_structured_validity_rate : null
      const count = typeof aj.current_trace_count === "number" ? aj.current_trace_count : null
      if (validityRate === null || count === null) return null
      return Math.round(validityRate * count)
    })(),
    guardrailsTotal: (() => {
      const aj = deployment.risk_analysis_json
      return typeof aj?.current_trace_count === "number" ? aj.current_trace_count : null
    })(),
    deployedAt: deployment.deployed_at,
  }
}
