import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import { getOperationsSurfaceData } from "@/lib/operations-timeline";
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

export async function getRegressionOperationsSurfaceData(regressionId: string): Promise<RegressionOperationsSurfaceData> {
  const sourceErrors: string[] = [];
  const [projectsResult, incidentsResult, operationsData] = await Promise.all([
    safeFetch(apiRequest<ListResponse<{ id: string }>>("/api/v1/projects")),
    safeFetch(apiRequest<ListResponse<IncidentRead>>("/api/v1/incidents?limit=25")),
    getOperationsSurfaceData(),
  ]);
  if (projectsResult.error) sourceErrors.push("projects");
  if (incidentsResult.error) sourceErrors.push("incidents");
  sourceErrors.push(...operationsData.sourceErrors);

  const firstProjectId = projectsResult.data?.items?.[0]?.id ?? null;
  const regressionsResult = firstProjectId
    ? await safeFetch(apiRequest<ListResponse<RegressionRead>>(`/api/v1/projects/${firstProjectId}/regressions?limit=50`))
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

  const compareLinks = [
    { label: "Trace compare", href: "/traces" },
    { label: "Related deployments", href: "/deployments" },
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
