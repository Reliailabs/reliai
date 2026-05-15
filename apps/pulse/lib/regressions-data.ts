import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import { mapRegressionListItem, type RegressionListItem, type RegressionRead } from "@/lib/regression-list-mapper";

type FetchResult<T> = { data: T | null; error: boolean };
type ListResponse<T> = { items: T[] };

export type RegressionsSurfaceData = {
  items: RegressionListItem[];
  sourceErrors: string[];
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

export async function getRegressionsSurfaceData(projectId?: string): Promise<RegressionsSurfaceData> {
  const sourceErrors: string[] = [];
  let resolvedProjectId: string | null = projectId ?? null;
  if (!resolvedProjectId) {
    const projectsResult = await safeFetch(apiRequest<ListResponse<{ id: string }>>("/api/v1/projects"));
    if (projectsResult.error) sourceErrors.push("projects");
    resolvedProjectId = projectsResult.data?.items?.[0]?.id ?? null;
    if (!resolvedProjectId) {
      return { items: [], sourceErrors };
    }
  }
  const regressionsResult = await safeFetch(
    apiRequest<ListResponse<RegressionRead>>(`/api/v1/projects/${resolvedProjectId}/regressions?limit=50`),
  );
  if (regressionsResult.error) sourceErrors.push("regressions");

  return {
    items: (regressionsResult.data?.items ?? []).map(mapRegressionListItem),
    sourceErrors,
  };
}
