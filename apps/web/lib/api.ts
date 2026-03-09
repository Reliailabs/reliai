import "server-only";

import { cookies } from "next/headers";

import type {
  AlertDeliveryListResponse,
  IncidentDetailRead,
  IncidentEventListResponse,
  IncidentListResponse,
  OrganizationAlertTargetRead,
  OrganizationAlertTargetTestResponse,
  OrganizationRead,
  ProjectListResponse,
  ProjectRead,
  RegressionDetailRead,
  RegressionListResponse,
  TraceComparisonRead,
  TraceDetailRead,
  TraceListResponse
} from "@reliai/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const SESSION_COOKIE_NAME = "reliai_session";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getApiHealth() {
  return request<{ status: string }>("/api/v1/health");
}

export async function createOrganization(payload: {
  name: string;
  slug: string;
  plan: OrganizationRead["plan"];
  owner_auth_user_id: string;
  owner_role: "owner";
}) {
  return request<OrganizationRead>("/api/v1/organizations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getOrganization(organizationId: string) {
  return request<OrganizationRead>(`/api/v1/organizations/${organizationId}`);
}

export async function getProject(projectId: string) {
  return request<ProjectRead>(`/api/v1/projects/${projectId}`);
}

export async function listProjects(filters: { organizationId?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set("organization_id", filters.organizationId);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return request<ProjectListResponse>(`/api/v1/projects${query ? `?${query}` : ""}`);
}

export interface TraceFilters {
  projectId?: string;
  modelName?: string;
  promptVersion?: string;
  success?: "true" | "false";
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

export async function listTraces(filters: TraceFilters = {}) {
  const params = new URLSearchParams();

  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.modelName) params.set("model_name", filters.modelName);
  if (filters.promptVersion) params.set("prompt_version", filters.promptVersion);
  if (filters.success) params.set("success", filters.success);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));

  const query = params.toString();
  return request<TraceListResponse>(`/api/v1/traces${query ? `?${query}` : ""}`);
}

export async function getTraceDetail(traceId: string) {
  return request<TraceDetailRead>(`/api/v1/traces/${traceId}`);
}

export async function listIncidents(filters: {
  projectId?: string;
  status?: "open" | "resolved";
  severity?: "critical" | "high" | "medium" | "low";
  ownerOperatorUserId?: string;
  ownerState?: "assigned" | "unassigned";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.ownerOperatorUserId) params.set("owner_operator_user_id", filters.ownerOperatorUserId);
  if (filters.ownerState) params.set("owner_state", filters.ownerState);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return request<IncidentListResponse>(`/api/v1/incidents${query ? `?${query}` : ""}`);
}

export async function getIncidentDetail(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}`);
}

export async function getIncidentTraceCompare(incidentId: string) {
  return request<TraceComparisonRead>(`/api/v1/incidents/${incidentId}/compare`);
}

export async function acknowledgeIncident(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/acknowledge`, {
    method: "POST"
  });
}

export async function assignIncidentOwner(
  incidentId: string,
  ownerOperatorUserId: string | null
) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/owner`, {
    method: "POST",
    body: JSON.stringify({ owner_operator_user_id: ownerOperatorUserId })
  });
}

export async function getIncidentAlerts(incidentId: string) {
  return request<AlertDeliveryListResponse>(`/api/v1/incidents/${incidentId}/alerts`);
}

export async function getIncidentEvents(incidentId: string) {
  return request<IncidentEventListResponse>(`/api/v1/incidents/${incidentId}/events`);
}

export async function resolveIncident(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/resolve`, {
    method: "POST"
  });
}

export async function reopenIncident(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/reopen`, {
    method: "POST"
  });
}

export async function listProjectRegressions(projectId: string, limit = 25) {
  return request<RegressionListResponse>(`/api/v1/projects/${projectId}/regressions?limit=${encodeURIComponent(String(limit))}`);
}

export async function listProjectRegressionsFiltered(
  projectId: string,
  filters: {
    metricName?: string;
    scopeId?: string;
    limit?: number;
  } = {}
) {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? 25));
  if (filters.metricName) params.set("metric_name", filters.metricName);
  if (filters.scopeId) params.set("scope_id", filters.scopeId);
  return request<RegressionListResponse>(`/api/v1/projects/${projectId}/regressions?${params.toString()}`);
}

export async function getRegressionDetail(regressionId: string) {
  return request<RegressionDetailRead>(`/api/v1/regressions/${regressionId}`);
}

export async function getOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target`);
}

export async function upsertOrgAlertTarget(
  organizationId: string,
  payload: {
    channel_target: string;
    slack_webhook_url?: string;
    is_active: boolean;
  }
) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function enableOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target/enable`, {
    method: "POST"
  });
}

export async function disableOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target/disable`, {
    method: "POST"
  });
}

export async function testOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetTestResponse>(`/api/v1/organizations/${organizationId}/alert-target/test`, {
    method: "POST"
  });
}
