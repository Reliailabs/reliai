import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type FetchResult<T> = { data: T | null; error: boolean };
type ListResponse<T> = { items: T[] };

type RegressionRead = {
  id: string;
  detected_at?: string | null;
  created_at?: string | null;
  summary?: string | null;
  status?: string | null;
};

export type RegressionListItem = {
  id: string;
  detectedAt: string | null;
  summary: string;
  status: string;
};

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

export async function getRegressionsSurfaceData(): Promise<RegressionsSurfaceData> {
  const sourceErrors: string[] = [];
  const projectsResult = await safeFetch(apiRequest<ListResponse<{ id: string }>>("/api/v1/projects"));
  if (projectsResult.error) sourceErrors.push("projects");
  const firstProjectId = projectsResult.data?.items?.[0]?.id ?? null;
  if (!firstProjectId) {
    return { items: [], sourceErrors };
  }
  const regressionsResult = await safeFetch(
    apiRequest<ListResponse<RegressionRead>>(`/api/v1/projects/${firstProjectId}/regressions?limit=50`),
  );
  if (regressionsResult.error) sourceErrors.push("regressions");

  return {
    items: (regressionsResult.data?.items ?? []).map((item) => ({
      id: item.id,
      detectedAt: item.detected_at ?? item.created_at ?? null,
      summary: item.summary ?? "Regression signal detected in reliability window.",
      status: item.status ?? "detected",
    })),
    sourceErrors,
  };
}
