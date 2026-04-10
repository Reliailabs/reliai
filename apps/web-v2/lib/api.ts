import "server-only";

import type {
  DeploymentListResponse,
  IncidentDetailRead,
  IncidentEventListResponse,
  IncidentInvestigationRead,
  IncidentListResponse,
  OrganizationAlertTargetRead,
  OrganizationGuardrailPolicyListResponse,
  ProjectListResponse,
  ProjectRead,
  PromptDiffRead,
  PromptVersionListResponse,
  RegressionListResponse,
  TraceListResponse,
  TraceReplayRead,
} from "@reliai/types";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export type DashboardTriageRead = {
  attention: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    project_id: string;
    project_name: string;
    environment_id: string;
    started_at: string;
    acknowledged_at: string | null;
    path: string;
  }>;
  recent_incident_activity: Array<{
    id: string;
    title: string;
    status: string;
    project_name: string;
    started_at: string;
    resolved_at: string | null;
    path: string;
  }>;
  investigation_links: {
    incidents: string;
    traces: string;
    reliability?: string | null;
  };
  context: {
    active_incident_count: number;
    unacknowledged_incident_count: number;
    degraded_project_count?: number | null;
    last_updated_at: string;
  };
};

export type DashboardChangeFeedRead = {
  changes: Array<{
    id: string;
    project_id: string;
    project_name: string;
    environment: string | null;
    kind: string;
    summary: string;
    created_at: string;
    actor?: string | null;
    related_incident_count?: number | null;
    related_regression_count?: number | null;
    path?: string | null;
  }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = await getApiAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getDashboardTriage() {
  return request<DashboardTriageRead>("/api/v1/dashboard/triage");
}

export async function getDashboardChanges() {
  return request<DashboardChangeFeedRead>("/api/v1/dashboard/changes");
}

export async function getIncidents() {
  return request<IncidentListResponse>("/api/v1/incidents");
}

export async function getIncidentDetail(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}`);
}

export async function getIncidentInvestigation(incidentId: string) {
  return request<IncidentInvestigationRead>(`/api/v1/incidents/${incidentId}/investigate`);
}

export async function getIncidentEvents(incidentId: string) {
  return request<IncidentEventListResponse>(`/api/v1/incidents/${incidentId}/events`);
}

export async function getTraces() {
  return request<TraceListResponse>("/api/v1/traces");
}

export async function getTraceReplay(traceId: string) {
  return request<TraceReplayRead>(`/api/v1/traces/${traceId}/replay`);
}

export async function getProjects() {
  return request<ProjectListResponse>("/api/v1/projects");
}

export async function getProject(projectId: string) {
  return request<ProjectRead>(`/api/v1/projects/${projectId}`);
}

export async function getOrganizationPolicies(organizationId: string) {
  return request<OrganizationGuardrailPolicyListResponse>(
    `/api/v1/organizations/${organizationId}/policies`
  );
}

export async function getDeployments() {
  return request<DeploymentListResponse>("/api/v1/deployments");
}

export async function getRegressions() {
  return request<RegressionListResponse>("/api/v1/regressions");
}

export async function getPromptVersions(projectId: string) {
  return request<PromptVersionListResponse>(`/api/v1/projects/${projectId}/prompt-versions`);
}

export async function getPromptDiff(fromVersionId: string, toVersionId: string) {
  const params = new URLSearchParams({
    fromVersionId,
    toVersionId,
  });
  return request<PromptDiffRead>(`/api/v1/prompts/diff?${params.toString()}`);
}

export async function getOrganizationAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(
    `/api/v1/organizations/${organizationId}/alert-target`
  );
}
