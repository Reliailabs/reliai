import "server-only";

import { format, formatDistanceToNowStrict } from "date-fns";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { CausalityConfidence, CausalityEvidenceData, CausalityEvidenceItem } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = { id: string; name: string };

type DeploymentRead = {
  id: string;
  created_at: string;
  deployed_at?: string | null;
  commit_hash?: string | null;
};

type IncidentRead = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  started_at: string;
  updated_at: string;
};

type TraceRead = {
  id: string;
  created_at: string;
  success: boolean;
};

type RegressionRead = {
  id: string;
  created_at?: string | null;
  detected_at?: string | null;
};

type ListResponse<T> = { items: T[] };

type Input = {
  demoMode: boolean;
  organizationId: string | null;
  projectId?: string | null;
};

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function relTime(value: Date | null): string {
  if (!value) return "unknown";
  return formatDistanceToNowStrict(value, { addSuffix: true });
}

function formatWindow(start: Date | null, end: Date | null): string {
  if (!start || !end) return "Evidence window unavailable";
  return `${format(start, "MMM d, HH:mm")} - ${format(end, "MMM d, HH:mm")}`;
}

function confidenceForSignals(input: { regressions: number; failedTraces: number; incidents: number }): CausalityConfidence {
  if (input.regressions === 0 && input.failedTraces === 0 && input.incidents === 0) return "insufficient";
  if (input.regressions >= 2 && input.failedTraces >= 3 && input.incidents >= 1) return "high";
  if (input.regressions >= 1 || input.failedTraces >= 2) return "medium";
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

function demoData(): CausalityEvidenceData {
  const now = new Date();
  const deployTime = new Date(now.getTime() - 1000 * 60 * 90);
  const degradeTime = new Date(now.getTime() - 1000 * 60 * 45);
  return {
    items: [
      {
        id: "demo-causality-1",
        title: "Likely related change: support workflow model update",
        summary:
          "Observed before degradation: failed eval and high-risk output signals increased after the latest deployment window.",
        confidence: "medium",
        evidenceWindow: formatWindow(deployTime, degradeTime),
        observedBeforeDegradation: relTime(degradeTime),
        requiresOperatorReview: true,
        links: [
          { label: "Deployment", href: "/deployments" },
          { label: "Incidents", href: "/incidents" },
          { label: "Traces", href: "/traces" },
        ],
      },
    ],
    sourceErrors: [],
    dataMode: "demo",
  };
}

export async function getCausalityEvidenceData({ demoMode, organizationId, projectId }: Input): Promise<CausalityEvidenceData> {
  if (demoMode) return demoData();

  const sourceErrors: string[] = [];
  const projectsResult = await safeFetch(apiRequest<ListResponse<ProjectRead>>("/api/v1/projects"));
  if (projectsResult.error) sourceErrors.push("projects");

  const project = projectId
    ? projectsResult.data?.items?.find((item) => item.id === projectId) ?? null
    : projectsResult.data?.items?.[0] ?? null;
  if (!organizationId || !project) {
    return { items: [], sourceErrors, dataMode: "live" };
  }

  const projectScopeFilter = `&project_id=${encodeURIComponent(project.id)}`;

  const [deploymentsResult, incidentsResult, tracesResult, regressionsResult] = await Promise.all([
    safeFetch(apiRequest<ListResponse<DeploymentRead>>(`/api/v1/projects/${project.id}/deployments`)),
    safeFetch(apiRequest<ListResponse<IncidentRead>>(`/api/v1/incidents?limit=25${projectScopeFilter}`)),
    safeFetch(apiRequest<ListResponse<TraceRead>>(`/api/v1/traces?limit=80${projectScopeFilter}`)),
    safeFetch(apiRequest<ListResponse<RegressionRead>>(`/api/v1/projects/${project.id}/regressions?limit=50`)),
  ]);

  if (deploymentsResult.error) sourceErrors.push("deployments");
  if (incidentsResult.error) sourceErrors.push("incidents");
  if (tracesResult.error) sourceErrors.push("traces");
  if (regressionsResult.error) sourceErrors.push("regressions");

  const deployments = (deploymentsResult.data?.items ?? [])
    .map((item) => ({ ...item, deployedAtDate: toDate(item.deployed_at ?? item.created_at) }))
    .filter((item) => item.deployedAtDate)
    .sort((a, b) => b.deployedAtDate!.getTime() - a.deployedAtDate!.getTime());

  const latestDeployment = deployments[0];
  if (!latestDeployment) {
    return {
      items: [
        {
          id: "causality-insufficient-deployments",
          title: "Likely related change: insufficient evidence",
          summary:
            "Evidence window unavailable. A recent deployment record is required before causality evidence can be scored. Requires operator review.",
          confidence: "insufficient",
          evidenceWindow: "Evidence window unavailable",
          observedBeforeDegradation: "insufficient data",
          requiresOperatorReview: true,
          links: [
            { label: "Deployments", href: "/deployments" },
            { label: "Incidents", href: "/incidents" },
            { label: "Traces", href: "/traces" },
          ],
        },
      ],
      sourceErrors,
      dataMode: "live",
    };
  }

  const deploymentTime = latestDeployment.deployedAtDate!;
  const incidents = (incidentsResult.data?.items ?? []).filter((item) => item.status !== "resolved");
  const regressions = regressionsResult.data?.items ?? [];
  const traces = tracesResult.data?.items ?? [];

  const postDeploymentIncidents = incidents.filter((incident) => {
    const started = toDate(incident.started_at);
    return started ? started.getTime() >= deploymentTime.getTime() : false;
  });
  const postDeploymentRegressions = regressions.filter((regression) => {
    const detected = toDate(regression.detected_at ?? regression.created_at);
    return detected ? detected.getTime() >= deploymentTime.getTime() : false;
  });
  const postDeploymentFailedTraces = traces.filter((trace) => {
    const created = toDate(trace.created_at);
    return created ? created.getTime() >= deploymentTime.getTime() && !trace.success : false;
  });

  const mostRecentIncidentStart = postDeploymentIncidents
    .map((incident) => toDate(incident.started_at))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const signalConfidence = confidenceForSignals({
    regressions: postDeploymentRegressions.length,
    failedTraces: postDeploymentFailedTraces.length,
    incidents: postDeploymentIncidents.length,
  });

  const evidenceItem: CausalityEvidenceItem = {
    id: `causality-${latestDeployment.id}`,
    title:
      signalConfidence === "insufficient"
        ? "Likely related change: insufficient evidence"
        : "Likely related change: latest deployment window",
    summary:
      signalConfidence === "insufficient"
        ? "Observed before degradation: not enough incident, regression, or trace-failure signal in the current evidence window. Requires operator review."
        : "Observed before degradation: incident and regression signals increased after deployment. Requires operator review before action.",
    confidence: signalConfidence,
    evidenceWindow: formatWindow(deploymentTime, mostRecentIncidentStart ?? new Date()),
    observedBeforeDegradation: relTime(mostRecentIncidentStart),
    requiresOperatorReview: true,
    links: [
      { label: "Deployment", href: "/deployments" },
      { label: "Incidents", href: "/incidents" },
      { label: "Traces", href: "/traces" },
    ],
  };

  return {
    items: [evidenceItem],
    sourceErrors: Array.from(new Set(sourceErrors)),
    dataMode: "live",
  };
}
