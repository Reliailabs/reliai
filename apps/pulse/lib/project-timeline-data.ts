import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = {
  id: string;
  name: string;
  environment?: string | null;
};

type TimelineEventRead = {
  timestamp: string;
  event_type: string;
  title: string;
  summary: string;
  severity: string | null;
  metadata: Record<string, unknown> | null;
};

type TimelineResponse = {
  items: TimelineEventRead[];
};

export type ProjectTimelineSurfaceData = {
  projectId: string;
  projectName: string;
  environment: string;
  items: TimelineEventRead[];
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

export async function getProjectTimelineSurfaceData(
  projectId: string,
  options?: { environment?: string; limit?: number },
): Promise<ProjectTimelineSurfaceData> {
  const sourceErrors: string[] = [];
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 100));
  if (options?.environment) params.set("environment", options.environment);

  const [projectResult, timelineResult] = await Promise.all([
    safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`)),
    safeFetch(apiRequest<TimelineResponse>(`/api/v1/projects/${projectId}/timeline?${params.toString()}`)),
  ]);

  if (projectResult.error) sourceErrors.push("project");
  if (timelineResult.error) sourceErrors.push("project-timeline");

  return {
    projectId,
    projectName: projectResult.data?.name ?? "Project",
    environment: options?.environment ?? projectResult.data?.environment ?? "unknown",
    items: timelineResult.data?.items ?? [],
    sourceErrors: Array.from(new Set(sourceErrors)),
  };
}
