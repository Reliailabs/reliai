import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { ProjectScopeOption } from "@/lib/project-scope-utils";

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

export async function listProjectScopeOptions(): Promise<ProjectScopeOption[]> {
  const result = await apiRequest<{ items: ProjectScopeOption[] }>("/api/v1/projects?limit=100").catch(() => null);
  return result?.items ?? [];
}
