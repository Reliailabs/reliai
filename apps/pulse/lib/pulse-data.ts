import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

import type { PulseOverviewData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type IncidentRead = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  updated_at: string;
  started_at: string;
  acknowledged_by_operator_email?: string | null;
};

type TraceRead = {
  id: string;
  success: boolean;
  created_at: string;
};

type DeploymentRead = {
  id: string;
  created_at: string;
};

type ListResponse<T> = {
  items: T[];
};

type PulseDataInput = {
  demoMode: boolean;
  organizationId: string | null;
  projectId?: string | null;
};

function relTime(value: string): string {
  try {
    return `${formatDistanceToNowStrict(new Date(value), { addSuffix: true })}`;
  } catch {
    return "recently";
  }
}

function computeAreiScore(input: {
  openCritical: number;
  openHigh: number;
  failedOutputs: number;
  regressions: number;
  hasAuditGap: boolean;
  deployments: number;
}) {
  const incidentRisk = Math.min(30, input.openCritical * 12 + input.openHigh * 6);
  const failureRisk = Math.min(25, input.failedOutputs * 2 + input.regressions * 4);
  const governanceGap = input.hasAuditGap ? 12 : 0;
  const changeRisk = Math.min(15, input.deployments * 2);
  return Math.min(100, incidentRisk + failureRisk + governanceGap + changeRisk);
}

async function apiRequest<T>(path: string): Promise<T> {
  const token = await getApiAccessToken();
  if (!token) {
    throw new Error("missing session token");
  }
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`api request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function safeFetch<T>(promise: Promise<T>): Promise<FetchResult<T>> {
  try {
    return { data: await promise, error: false };
  } catch {
    return { data: null, error: true };
  }
}

function demoOverviewData(): PulseOverviewData {
  const now = new Date().toISOString();
  return {
    metrics: [
      { label: "Active Incidents", value: "3", change: "+1", trend: "up" },
      { label: "Regression Detections", value: "5", change: "+2", trend: "up" },
      { label: "Failed Evals", value: "18", change: "-3", trend: "down" },
      { label: "High-Risk Outputs", value: "11", change: "+1", trend: "up" },
    ],
    activeIncidents: [
      { id: "INC-DEMO-1", title: "Hallucination spike in support workflow", severity: "critical", duration: "22m", assignee: "On-call" },
      { id: "INC-DEMO-2", title: "Retrieval timeout increase", severity: "high", duration: "48m", assignee: "Reliability" },
    ],
    timelinePoints: [
      { time: "00:00", requests: 9000, errors: 22 },
      { time: "06:00", requests: 11000, errors: 28 },
      { time: "12:00", requests: 16000, errors: 64 },
      { time: "18:00", requests: 14000, errors: 41 },
      { time: "Now", requests: 15000, errors: 36 },
    ],
    areiScore: 68,
    areiDelta: 6,
    recentActivity: [
      { id: "demo-1", type: "incident", title: "Critical incident opened", time: relTime(now), status: "active" },
      { id: "demo-2", type: "deploy", title: "Model update deployed", time: relTime(now), status: "success" },
    ],
    dataMode: "demo",
    sourceErrors: [],
  };
}

export async function getPulseOverviewData({ demoMode, organizationId, projectId }: PulseDataInput): Promise<PulseOverviewData> {
  if (demoMode) {
    return demoOverviewData();
  }

  const explicitProjectFilter = projectId ? `&project_id=${encodeURIComponent(projectId)}` : "";
  const explicitProjectAuditFilter = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const [incidentsResult, tracesResult, auditsResult, projectsResult] = await Promise.all([
    safeFetch(apiRequest<ListResponse<IncidentRead>>(`/api/v1/incidents?limit=20${explicitProjectFilter}`)),
    safeFetch(apiRequest<ListResponse<TraceRead>>(`/api/v1/traces?limit=20${explicitProjectFilter}`)),
    safeFetch(apiRequest<{ items: Array<{ latest_run?: { status?: string | null } | null }> }>(`/api/v1/audits${explicitProjectAuditFilter}`)),
    safeFetch(apiRequest<{ items: Array<{ id: string }> }>("/api/v1/projects")),
  ]);

  const sourceErrors: string[] = [];
  if (incidentsResult.error) sourceErrors.push("incidents");
  if (tracesResult.error) sourceErrors.push("traces");
  if (auditsResult.error) sourceErrors.push("audits");
  if (projectsResult.error) sourceErrors.push("projects");

  const incidents = incidentsResult.data?.items ?? [];
  const traces = tracesResult.data?.items ?? [];
  const audits = auditsResult.data?.items ?? [];
  const firstProjectId = projectsResult.data?.items?.[0]?.id;
  const scopedProjectId = projectId ?? firstProjectId;

  const regressionsResult =
    organizationId && scopedProjectId
      ? await safeFetch(apiRequest<{ items: Array<{ id: string }> }>(`/api/v1/projects/${scopedProjectId}/regressions?limit=20`))
      : ({ data: { items: [] }, error: false } as FetchResult<{ items: Array<{ id: string }> }>);
  const deploymentsResult =
    organizationId && scopedProjectId
      ? await safeFetch(apiRequest<ListResponse<DeploymentRead>>(`/api/v1/projects/${scopedProjectId}/deployments`))
      : ({ data: { items: [] }, error: false } as FetchResult<ListResponse<DeploymentRead>>);

  if (regressionsResult.error) sourceErrors.push("regressions");
  if (deploymentsResult.error) sourceErrors.push("deployments");

  const regressions = regressionsResult.data?.items ?? [];
  const deployments = deploymentsResult.data?.items ?? [];

  const openIncidents = incidents.filter((item) => item.status !== "resolved");
  const openCritical = openIncidents.filter((item) => item.severity === "critical").length;
  const openHigh = openIncidents.filter((item) => item.severity === "high").length;
  const failedOutputs = traces.filter((trace) => !trace.success).length;
  const hasAuditGap = audits.some((audit) => (audit.latest_run?.status ?? "queued") !== "completed");

  const areiScore = computeAreiScore({
    openCritical,
    openHigh,
    failedOutputs,
    regressions: regressions.length,
    hasAuditGap,
    deployments: deployments.length,
  });

  return {
    metrics: [
      { label: "Active Incidents", value: String(openIncidents.length), change: openIncidents.length > 0 ? `+${openIncidents.length}` : "0", trend: openIncidents.length > 0 ? "up" : "down" },
      { label: "Regression Detections", value: String(regressions.length), change: regressions.length > 0 ? `+${regressions.length}` : "0", trend: regressions.length > 0 ? "up" : "down" },
      { label: "Failed Evals", value: String(failedOutputs), change: failedOutputs > 0 ? `+${failedOutputs}` : "0", trend: failedOutputs > 0 ? "up" : "down" },
      { label: "High-Risk Outputs", value: String(failedOutputs), change: failedOutputs > 0 ? `+${failedOutputs}` : "0", trend: failedOutputs > 0 ? "up" : "down" },
    ],
    activeIncidents: openIncidents.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      duration: relTime(item.started_at),
      assignee: item.acknowledged_by_operator_email ?? "Unassigned",
    })),
    timelinePoints: [
      { time: "00:00", requests: traces.length * 120, errors: Math.max(0, failedOutputs - 2) },
      { time: "06:00", requests: traces.length * 140, errors: Math.max(0, failedOutputs - 1) },
      { time: "12:00", requests: traces.length * 180, errors: failedOutputs },
      { time: "18:00", requests: traces.length * 160, errors: Math.max(0, failedOutputs - 1) },
      { time: "Now", requests: traces.length * 170, errors: failedOutputs },
    ],
    areiScore,
    areiDelta: null,
    recentActivity: [
      ...openIncidents.slice(0, 2).map((item) => ({
        id: `incident-${item.id}`,
        type: "incident" as const,
        title: item.title,
        time: relTime(item.updated_at),
        status: item.status === "resolved" ? "resolved" : "active",
      })),
      ...deployments.slice(0, 2).map((item) => ({
        id: `deployment-${item.id}`,
        type: "deploy" as const,
        title: `Deployment ${item.id.slice(0, 8)}`,
        time: relTime(item.created_at),
        status: "success" as const,
      })),
    ],
    dataMode: "live",
    sourceErrors,
  };
}
