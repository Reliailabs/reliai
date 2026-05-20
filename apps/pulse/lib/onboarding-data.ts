import "server-only";

import type { OrganizationRead, ProjectRead, TraceListResponse } from "@reliai/types";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getApiAccessToken();
  if (!token) throw new Error("unauthorized");

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`onboarding request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiRequestOrNull<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = await getApiAccessToken();
  if (!token) throw new Error("unauthorized");

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`onboarding request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function defaultOrgName(email?: string | null) {
  if (!email) return "Reliai Workspace";
  const domain = email.split("@")[1];
  if (!domain) return "Reliai Workspace";
  const label = domain.split(".")[0] || "Reliai";
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} Workspace`;
}

export async function createOrganization(payload: {
  name: string;
  slug: string;
  plan: OrganizationRead["plan"];
  owner_auth_user_id: string;
  owner_role: "owner";
}) {
  return apiRequest<OrganizationRead>("/api/v1/organizations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createProject(
  organizationId: string,
  payload: {
    name: string;
    slug: string;
    environment: "prod" | "staging" | "dev";
    description?: string | null;
  },
) {
  return apiRequest<ProjectRead>(`/api/v1/organizations/${organizationId}/projects`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

type ApiKeyCreateResponse = { api_key: string };

export async function createApiKey(projectId: string, payload: { label: string }) {
  return apiRequest<ApiKeyCreateResponse>(`/api/v1/projects/${projectId}/api-keys`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listProjects(organizationId: string) {
  return apiRequest<{ items: ProjectRead[] }>(`/api/v1/organizations/${organizationId}/projects?limit=50`);
}

export async function getProject(projectId: string) {
  return apiRequestOrNull<ProjectRead>(`/api/v1/projects/${projectId}`);
}

export async function listProjectTraces(projectId: string) {
  return apiRequest<TraceListResponse>(`/api/v1/projects/${projectId}/traces?limit=1`);
}
