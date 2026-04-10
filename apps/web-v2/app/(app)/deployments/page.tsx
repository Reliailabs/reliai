import { getDeployments, getProjects } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { DeploymentsView, type DeploymentRecord } from "./deployments-view"

export default async function DeploymentsPage() {
  const [data, projects] = await Promise.all([getDeployments(), getProjects()])
  const now = Date.now()
  const projectMap = new Map(projects.items.map((project) => [project.id, project.name]))

  const deployments: DeploymentRecord[] = data.items.map((deployment) => ({
    id: deployment.id,
    name: projectMap.get(deployment.project_id) ?? deployment.project_id.slice(0, 8),
    version:
      typeof deployment.metadata_json?.version === "string"
        ? deployment.metadata_json.version
        : "v—",
    project: projectMap.get(deployment.project_id) ?? deployment.project_id,
    model:
      typeof deployment.metadata_json?.model === "string"
        ? deployment.metadata_json.model
        : "—",
    status: "live",
    gateStatus: "pass",
    riskScore: 0,
    riskFactors: [],
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
    evalsPassed: null,
    evalsTotal: null,
    guardrailsPassed: null,
    guardrailsTotal: null,
    deployedAt: deployment.deployed_at,
  }))

  return <DeploymentsView deployments={deployments} />
}
