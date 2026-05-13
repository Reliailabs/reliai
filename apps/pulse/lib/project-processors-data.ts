import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = {
  id: string;
  name: string;
  environment?: string | null;
};

type ExternalProcessorRead = {
  id: string;
  project_id: string;
  name: string;
  event_type: string;
  endpoint_url: string;
  enabled: boolean;
  has_secret: boolean;
  created_at: string;
  recent_failure_count: number;
  last_failure_at: string | null;
};

type ExternalProcessorListResponse = {
  items: ExternalProcessorRead[];
};

export type ProjectProcessorsSurfaceData = {
  projectId: string;
  projectName: string;
  environment: string;
  processors: ExternalProcessorRead[];
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

export async function getProjectProcessorsSurfaceData(projectId: string): Promise<ProjectProcessorsSurfaceData> {
  const sourceErrors: string[] = [];

  const [projectResult, processorsResult] = await Promise.all([
    safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`)),
    safeFetch(apiRequest<ExternalProcessorListResponse>(`/api/v1/projects/${projectId}/processors`)),
  ]);

  if (projectResult.error) sourceErrors.push("project");
  if (processorsResult.error) sourceErrors.push("project-processors");

  return {
    projectId,
    projectName: projectResult.data?.name ?? "Project",
    environment: projectResult.data?.environment ?? "unknown",
    processors: processorsResult.data?.items ?? [],
    sourceErrors: Array.from(new Set(sourceErrors)),
  };
}
