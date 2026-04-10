import "server-only";

import type {
  AlertDeliveryListResponse,
  DeploymentListResponse,
  IncidentDetailRead,
  IncidentEventListResponse,
  IncidentInvestigationRead,
  IncidentListResponse,
  OrganizationAlertTargetRead,
  OrganizationMemberListResponse,
  OrganizationRead,
  OrganizationGuardrailPolicyListResponse,
  ProjectListResponse,
  ProjectReliabilityRead,
  ProjectRead,
  ProjectSLOListResponse,
  PromptDiffRead,
  PromptVersionListResponse,
  RegressionHistoryRead,
  RegressionListResponse,
  TraceDetailRead,
  TraceListResponse,
  TraceReplayRead,
  UsageQuotaStatusRead,
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
    avg_mttr_minutes?: number | null;
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

export async function getIncidents(options?: {
  status?: string;
  severity?: string;
  project_id?: string;
  environment?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.severity) params.set("severity", options.severity);
  if (options?.project_id) params.set("project_id", options.project_id);
  if (options?.environment) params.set("environment", options.environment);
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.size ? `?${params.toString()}` : "";
  return request<IncidentListResponse>(`/api/v1/incidents${query}`);
}

export async function getIncidentDetail(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}`);
}

export async function getIncidentInvestigation(incidentId: string) {
  return request<IncidentInvestigationRead>(`/api/v1/incidents/${incidentId}/investigation`);
}

export async function getIncidentEvents(incidentId: string) {
  return request<IncidentEventListResponse>(`/api/v1/incidents/${incidentId}/events`);
}

export async function getTraces(options?: {
  environment?: string;
  success?: boolean;
  project_id?: string;
  cursor?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.environment) params.set("environment", options.environment);
  if (options?.success !== undefined) params.set("success", String(options.success));
  if (options?.project_id) params.set("project_id", options.project_id);
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.size ? `?${params.toString()}` : "";
  return request<TraceListResponse>(`/api/v1/traces${query}`);
}

export async function getTraceDetail(traceId: string) {
  return request<TraceDetailRead>(`/api/v1/traces/${traceId}`);
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

export async function getProjectReliability(projectId: string) {
  return request<ProjectReliabilityRead>(`/api/v1/projects/${projectId}/reliability`);
}

export async function getProjectSLOs(projectId: string) {
  return request<ProjectSLOListResponse>(`/api/v1/projects/${projectId}/slos`);
}

export async function getOrganizationPolicies(organizationId: string) {
  return request<OrganizationGuardrailPolicyListResponse>(
    `/api/v1/organizations/${organizationId}/policies`
  );
}

export async function getProjectDeployments(projectId: string) {
  return request<DeploymentListResponse>(`/api/v1/projects/${projectId}/deployments`);
}

export async function getProjectRegressions(
  projectId: string,
  options?: { metric_name?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (options?.metric_name) params.set("metric_name", options.metric_name);
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.size ? `?${params.toString()}` : "";
  return request<RegressionListResponse>(`/api/v1/projects/${projectId}/regressions${query}`);
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

export async function getOrganization(organizationId: string) {
  return request<OrganizationRead>(`/api/v1/organizations/${organizationId}`);
}

export async function getOrganizationMembers(organizationId: string) {
  return request<OrganizationMemberListResponse>(
    `/api/v1/organizations/${organizationId}/members`
  );
}

export async function getOrganizationAlertDeliveries(
  organizationId: string,
  options?: {
    limit?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.status) params.set("status", options.status);
  if (options?.date_from) params.set("date_from", options.date_from);
  if (options?.date_to) params.set("date_to", options.date_to);
  const query = params.size ? `?${params.toString()}` : "";
  return request<AlertDeliveryListResponse>(
    `/api/v1/organizations/${organizationId}/alert-deliveries${query}`
  );
}

export async function getOrganizationUsageQuota(organizationId: string) {
  return request<UsageQuotaStatusRead>(
    `/api/v1/organizations/${organizationId}/usage-quota`
  );
}

export async function getRegressionHistory(projectId: string, regressionId: string) {
  return request<RegressionHistoryRead>(
    `/api/v1/projects/${projectId}/regressions/${regressionId}/history`
  );
}
