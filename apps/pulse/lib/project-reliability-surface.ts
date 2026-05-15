import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { ProjectReliabilityRead, ProjectRead } from "@reliai/types";
import { mapProjectReliabilityPresenter, type ProjectReliabilityPresenter } from "@/lib/project-reliability-mapper";

type FetchResult<T> = { data: T | null; error: boolean };

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

export async function getProjectReliabilityPresenter(projectId: string): Promise<ProjectReliabilityPresenter> {
  const sourceErrors: string[] = [];
  const [projectResult, reliabilityResult] = await Promise.all([
    safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`)),
    safeFetch(apiRequest<ProjectReliabilityRead>(`/api/v1/projects/${projectId}/reliability`)),
  ]);
  if (projectResult.error) sourceErrors.push("project");
  if (reliabilityResult.error) sourceErrors.push("project-reliability");
  const projectName = projectResult.data?.name ?? "Project";
  return mapProjectReliabilityPresenter(projectId, projectName, reliabilityResult.data, sourceErrors);
}
