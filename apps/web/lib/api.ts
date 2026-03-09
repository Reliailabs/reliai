import "server-only";

import { cookies } from "next/headers";

import type {
  AlertDeliveryListResponse,
  IncidentDetailRead,
  IncidentListResponse,
  OrganizationRead,
  ProjectRead,
  RegressionListResponse,
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

export async function getProject(projectId: string) {
  return request<ProjectRead>(`/api/v1/projects/${projectId}`);
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
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return request<IncidentListResponse>(`/api/v1/incidents${query ? `?${query}` : ""}`);
}

export async function getIncidentDetail(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}`);
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

export async function listProjectRegressions(projectId: string, limit = 25) {
  return request<RegressionListResponse>(
    `/api/v1/projects/${projectId}/regressions?limit=${encodeURIComponent(String(limit))}`
  );
}
