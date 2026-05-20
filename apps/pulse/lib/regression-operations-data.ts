import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import { getOperationsSurfaceData } from "@/lib/operations-timeline";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";
import { listLifecycles, type ProposalLifecycle } from "@/lib/proposal-lifecycle";
import { getVerificationResults } from "@/lib/operations-verification-results";
import type { OperationsTimelineEntry } from "@/components/dashboard/pulse-types";

export type RegressionOperationsTab =
  | "overview"
  | "compare"
  | "timeline"
  | "related-incidents"
  | "proposals"
  | "verification";

type RegressionRead = {
  id: string;
  detected_at?: string | null;
  created_at?: string | null;
  summary?: string | null;
  status?: string | null;
  project_id?: string | null;
};

type IncidentRead = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  started_at: string;
  summary_json?: Record<string, unknown> | null;
};

type ListResponse<T> = { items: T[] };
type FetchResult<T> = { data: T | null; error: boolean };

export type RegressionOperationsSurfaceData = {
  regressionId: string;
  regression: {
    id: string;
    detectedAt: string | null;
    summary: string;
    status: string;
  } | null;
  compareLinks: Array<{ label: string; href: string }>;
  timelineEntries: OperationsTimelineEntry[];
  relatedIncidents: Array<{ id: string; title: string; severity: string; status: string }>;
  proposals: ProposalLifecycle[];
  verificationRecords: Array<{ proposalId: string; state: "verified" | "failed"; verificationResultId: string | null; updatedAt: string }>;
  sourceErrors: string[];
  dataMode: "live" | "demo";
};

async function apiRequest<T>(path: string): Promise<T> {
  const token = await getApiAccessToken();
  if (!token) throw new Error("missing session token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`api request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function safeFetch<T>(promise: Promise<T>): Promise<FetchResult<T>> {
  try {
    return { data: await promise, error: false };
  } catch {
    return { data: null, error: true };
  }
}

export async function getRegressionOperationsSurfaceData(regressionId: string, projectId?: string | null): Promise<RegressionOperationsSurfaceData> {
  const sourceErrors: string[] = [];
  const incidentProjectFilter = projectId ? `&project_id=${encodeURIComponent(projectId)}` : "";
  const [projectsResult, incidentsResult, operationsData] = await Promise.all([
    safeFetch(apiRequest<ListResponse<{ id: string; name: string; created_at: string }>>("/api/v1/projects")),
    safeFetch(apiRequest<ListResponse<IncidentRead>>(`/api/v1/incidents?limit=25${incidentProjectFilter}`)),
    getOperationsSurfaceData(undefined, { filter: projectId ? { project_id: projectId } : undefined }),
  ]);
  if (projectsResult.error) sourceErrors.push("projects");
  if (incidentsResult.error) sourceErrors.push("incidents");
  sourceErrors.push(...operationsData.sourceErrors);

  const resolvedProjectId = resolveScopedProjectId(projectsResult.data?.items ?? [], projectId ?? null);
  const regressionsResult = resolvedProjectId
    ? await safeFetch(apiRequest<ListResponse<RegressionRead>>(`/api/v1/projects/${resolvedProjectId}/regressions?limit=50`))
    : { data: null, error: true };
  if (regressionsResult.error) sourceErrors.push("regressions");

  const regression = (regressionsResult.data?.items ?? []).find((item) => item.id === regressionId) ?? null;
  const incidents = incidentsResult.data?.items ?? [];

  const relatedIncidents = incidents
    .filter((item) => {
      const ids = item.summary_json?.sample_trace_ids;
      if (!Array.isArray(ids)) return false;
      return ids.includes(regressionId);
    })
    .slice(0, 6)
    .map((item) => ({ id: item.id, title: item.title, severity: item.severity, status: item.status }));

  const timelineEntries = operationsData.entries.filter((entry) =>
    entry.summary.toLowerCase().includes(regressionId.toLowerCase()) ||
    entry.title.toLowerCase().includes("regression"),
  );

  const proposals = listLifecycles().filter((proposal) =>
    proposal.target_id === regressionId ||
    proposal.proposal_id.toLowerCase().includes("regression"),
  );

  const proposalById = new Map(proposals.map((proposal) => [proposal.proposal_id, proposal]));
  const verificationRecords = getVerificationResults({ target_id: regressionId })
    .filter((record) => proposalById.has(record.proposal_id))
    .map((record) => ({
      proposalId: record.proposal_id,
      state: record.outcome === "passed" ? ("verified" as const) : ("failed" as const),
      verificationResultId: record.verification_result_id,
      updatedAt: record.verified_at,
    }));

  const scopeQuery = resolvedProjectId ? `?project_id=${encodeURIComponent(resolvedProjectId)}` : "";
  const compareLinks = [
    { label: "Trace compare", href: `/traces${scopeQuery}` },
    { label: "Related deployments", href: `/deployments${scopeQuery}` },
  ];

  if (!regression) {
    return {
      regressionId,
      regression: null,
      compareLinks,
      timelineEntries,
      relatedIncidents,
      proposals,
      verificationRecords,
      sourceErrors: Array.from(new Set(sourceErrors)),
      dataMode: operationsData.dataMode,
    };
  }

  return {
    regressionId,
    regression: {
      id: regression.id,
      detectedAt: regression.detected_at ?? regression.created_at ?? null,
      summary: regression.summary ?? "Regression signal detected in current reliability window.",
      status: regression.status ?? "detected",
    },
    compareLinks,
    timelineEntries,
    relatedIncidents,
    proposals,
    verificationRecords,
    sourceErrors: Array.from(new Set(sourceErrors)),
    dataMode: operationsData.dataMode,
  };
}
