import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { AttributionSuggestionData, CausalityConfidence } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };
type ListResponse<T> = { items: T[] };

type ProjectRead = { id: string };
type IncidentRead = { id: string; status: string; severity: "critical" | "high" | "medium" | "low"; started_at: string };
type DeploymentRead = { id: string; created_at: string; commit_hash?: string | null };
type TraceRead = { id: string; created_at: string; success: boolean };
type RegressionRead = { id: string; detected_at?: string | null; created_at?: string | null };

type Input = { demoMode: boolean; organizationId: string | null; projectId?: string | null };

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function confidence(input: { regressions: number; failedTraces: number; incidents: number }): CausalityConfidence {
  if (input.regressions === 0 && input.failedTraces === 0 && input.incidents === 0) return "insufficient";
  if (input.regressions >= 2 && input.failedTraces >= 3 && input.incidents >= 1) return "high";
  if (input.regressions >= 1 || input.failedTraces >= 2 || input.incidents >= 1) return "medium";
  return "low";
}

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

function demoData(): AttributionSuggestionData {
  return {
    items: [
      {
        id: "demo-attribution-1",
        title: "Advisory: review retrieval configuration before latest incident cluster",
        suggestion: "Inspect retrieval chunking and prompt template changes in the latest release window.",
        reason: "Failed outputs and regressions increased after deployment. Requires operator review.",
        confidence: "medium",
        requiresOperatorReview: true,
        links: [
          { label: "Deployments", href: "/deployments" },
          { label: "Traces", href: "/traces" },
          { label: "Incidents", href: "/incidents" },
        ],
      },
    ],
    sourceErrors: [],
    dataMode: "demo",
  };
}

export async function getAttributionSuggestionsData({ demoMode, organizationId, projectId }: Input): Promise<AttributionSuggestionData> {
  if (demoMode) return demoData();

  const sourceErrors: string[] = [];
  const projectResult = await safeFetch(apiRequest<ListResponse<ProjectRead>>("/api/v1/projects"));
  if (projectResult.error) sourceErrors.push("projects");
  const scopedProjectId = projectId
    ? projectResult.data?.items?.find((item) => item.id === projectId)?.id ?? null
    : projectResult.data?.items?.[0]?.id ?? null;
  if (!organizationId || !scopedProjectId) return { items: [], sourceErrors, dataMode: "live" };
  const projectScopeFilter = `&project_id=${encodeURIComponent(scopedProjectId)}`;

  const [deploymentsResult, incidentsResult, tracesResult, regressionsResult] = await Promise.all([
    safeFetch(apiRequest<ListResponse<DeploymentRead>>(`/api/v1/projects/${scopedProjectId}/deployments`)),
    safeFetch(apiRequest<ListResponse<IncidentRead>>(`/api/v1/incidents?limit=25${projectScopeFilter}`)),
    safeFetch(apiRequest<ListResponse<TraceRead>>(`/api/v1/traces?limit=120${projectScopeFilter}`)),
    safeFetch(apiRequest<ListResponse<RegressionRead>>(`/api/v1/projects/${scopedProjectId}/regressions?limit=50`)),
  ]);
  if (deploymentsResult.error) sourceErrors.push("deployments");
  if (incidentsResult.error) sourceErrors.push("incidents");
  if (tracesResult.error) sourceErrors.push("traces");
  if (regressionsResult.error) sourceErrors.push("regressions");

  const latestDeployment = (deploymentsResult.data?.items ?? [])
    .map((item) => ({ ...item, at: toDate(item.created_at) }))
    .filter((item) => item.at)
    .sort((a, b) => b.at!.getTime() - a.at!.getTime())[0];

  if (!latestDeployment?.at) {
    return {
      items: [
        {
          id: "advisory-insufficient-deployments",
          title: "Advisory: insufficient evidence for attribution",
          suggestion: "Add deployment metadata and continue collecting incident and trace signals.",
          reason: "A recent deployment reference is required before advisory attribution can be scored. Requires operator review.",
          confidence: "insufficient",
          requiresOperatorReview: true,
          links: [
            { label: "Deployments", href: "/deployments" },
            { label: "Incidents", href: "/incidents" },
            { label: "Traces", href: "/traces" },
          ],
        },
      ],
      sourceErrors: Array.from(new Set(sourceErrors)),
      dataMode: "live",
    };
  }

  const depTime = latestDeployment.at.getTime();
  const openIncidents = (incidentsResult.data?.items ?? []).filter((i) => i.status !== "resolved");
  const postIncidents = openIncidents.filter((i) => (toDate(i.started_at)?.getTime() ?? 0) >= depTime);
  const failedTraces = (tracesResult.data?.items ?? []).filter((t) => !t.success && (toDate(t.created_at)?.getTime() ?? 0) >= depTime);
  const regressions = (regressionsResult.data?.items ?? []).filter((r) => (toDate(r.detected_at ?? r.created_at)?.getTime() ?? 0) >= depTime);

  const suggestionConfidence = confidence({
    incidents: postIncidents.length,
    failedTraces: failedTraces.length,
    regressions: regressions.length,
  });

  const suggestionItems = [
    {
      id: `advisory-${latestDeployment.id}`,
      title:
        suggestionConfidence === "insufficient"
          ? "Advisory: insufficient evidence for attribution"
          : "Advisory: investigate latest deployment as likely related change",
      suggestion:
        suggestionConfidence === "insufficient"
          ? "Continue collecting deployment, incident, and trace evidence before deciding likely source."
          : "Review model/prompt and retrieval deltas in the latest deployment window before applying mitigation.",
      reason:
        suggestionConfidence === "insufficient"
          ? "Observed before degradation: no strong post-deployment signal cluster yet. Requires operator review."
          : "Observed before degradation: incident/regression/failure signals rose after deployment. Requires operator review.",
      confidence: suggestionConfidence,
      requiresOperatorReview: true as const,
      links: [
        { label: "Deployments", href: "/deployments" },
        { label: "Incidents", href: "/incidents" },
        { label: "Traces", href: "/traces" },
      ],
    },
  ];

  return {
    items: suggestionItems,
    sourceErrors: Array.from(new Set(sourceErrors)),
    dataMode: "live",
  };
}
