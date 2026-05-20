import "server-only";

import { getOperationsSurfaceData } from "@/lib/operations-timeline";
import { listLifecycles } from "@/lib/proposal-lifecycle";
import { getIncidentsSurfaceData } from "@/lib/incidents-data";
import { getRegressionsSurfaceData } from "@/lib/regressions-data";

export type OperationsGraphNodeType =
  | "deployment"
  | "regression"
  | "incident"
  | "proposal"
  | "verification";

export type OperationsGraphNode = {
  id: string;
  type: OperationsGraphNodeType;
  label: string;
  href: string;
  summary: string;
};

export type OperationsGraphEdge = {
  from: string;
  to: string;
  relation: string;
};

export type OperationsGraphSurfaceData = {
  entityId: string;
  projectId: string | null;
  nodes: OperationsGraphNode[];
  edges: OperationsGraphEdge[];
  sourceErrors: string[];
};

export async function getOperationsGraphSurfaceData(entityId: string, projectId?: string | null): Promise<OperationsGraphSurfaceData> {
  const sourceErrors: string[] = [];
  const scopeQuery = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const [timelineData, incidentsData, regressionsData] = await Promise.all([
    getOperationsSurfaceData(undefined, { filter: projectId ? { project_id: projectId } : undefined }),
    getIncidentsSurfaceData(projectId ?? undefined),
    getRegressionsSurfaceData(projectId ?? undefined),
  ]);
  sourceErrors.push(...timelineData.sourceErrors, ...incidentsData.sourceErrors, ...regressionsData.sourceErrors);

  const lifecycles = listLifecycles();
  const nodes: OperationsGraphNode[] = [];
  const edges: OperationsGraphEdge[] = [];

  const regression = regressionsData.items.find((r) => r.id === entityId);
  if (regression) {
    nodes.push({
      id: `regression:${regression.id}`,
      type: "regression",
      label: regression.id,
      href: `/operations/regressions/${regression.id}${scopeQuery}`,
      summary: regression.summary,
    });
  }

  const incident = incidentsData.incidents.find((i) => i.id === entityId);
  if (incident) {
    nodes.push({
      id: `incident:${incident.id}`,
      type: "incident",
      label: incident.id,
      href: `/operations/incidents/${incident.id}${scopeQuery}`,
      summary: incident.title,
    });
  }

  for (const lifecycle of lifecycles) {
    if (
      lifecycle.target_id === entityId ||
      lifecycle.proposal_id.includes(entityId) ||
      timelineData.entries.some((e) => e.proposal_id === lifecycle.proposal_id && (e.incident_id === entityId || e.summary.includes(entityId)))
    ) {
      const proposalNodeId = `proposal:${lifecycle.proposal_id}`;
      nodes.push({
        id: proposalNodeId,
        type: "proposal",
        label: lifecycle.proposal_id,
        href: `/operations${scopeQuery ? `${scopeQuery}&proposal=${encodeURIComponent(lifecycle.proposal_id)}` : `?proposal=${encodeURIComponent(lifecycle.proposal_id)}`}`,
        summary: `${lifecycle.action_type} • ${lifecycle.state}`,
      });
      if (lifecycle.verification_result_id) {
        const verificationId = `verification:${lifecycle.verification_result_id}`;
        nodes.push({
          id: verificationId,
          type: "verification",
          label: lifecycle.verification_result_id,
          href: `/operations/incidents/${lifecycle.target_id}${scopeQuery ? `${scopeQuery}&tab=verification` : "?tab=verification"}`,
          summary: "Verification result record",
        });
        edges.push({ from: proposalNodeId, to: verificationId, relation: "verified_by" });
      }
      if (lifecycle.target_type === "incident") {
        edges.push({ from: proposalNodeId, to: `incident:${lifecycle.target_id}`, relation: "targets" });
      }
      if (regression) {
        edges.push({ from: `regression:${regression.id}`, to: proposalNodeId, relation: "drives" });
      }
    }
  }

  for (const entry of timelineData.entries.slice(0, 80)) {
    if (entry.proposal_id && !nodes.find((n) => n.id === `proposal:${entry.proposal_id}`)) {
      nodes.push({
        id: `proposal:${entry.proposal_id}`,
        type: "proposal",
        label: entry.proposal_id,
        href: `/operations${scopeQuery ? `${scopeQuery}&proposal=${encodeURIComponent(entry.proposal_id)}` : `?proposal=${encodeURIComponent(entry.proposal_id)}`}`,
        summary: entry.title,
      });
    }
    if (entry.incident_id && !nodes.find((n) => n.id === `incident:${entry.incident_id}`)) {
      nodes.push({
        id: `incident:${entry.incident_id}`,
        type: "incident",
        label: entry.incident_id,
        href: `/operations/incidents/${entry.incident_id}${scopeQuery}`,
        summary: entry.summary,
      });
    }
    if (entry.proposal_id && entry.incident_id) {
      edges.push({ from: `incident:${entry.incident_id}`, to: `proposal:${entry.proposal_id}`, relation: "linked_to" });
    }
  }

  const dedupNodes = Array.from(new Map(nodes.map((n) => [n.id, n])).values());
  const dedupEdges = Array.from(new Map(edges.map((e) => [`${e.from}|${e.to}|${e.relation}`, e])).values());
  return { entityId, projectId: projectId ?? null, nodes: dedupNodes, edges: dedupEdges, sourceErrors: Array.from(new Set(sourceErrors)) };
}
