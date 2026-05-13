import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  environment?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProjectSettingsSurfaceData = {
  project: ProjectRead | null;
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

export async function getProjectSettingsSurfaceData(projectId: string): Promise<ProjectSettingsSurfaceData> {
  const projectResult = await safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`));
  return {
    project: projectResult.data,
    sourceErrors: projectResult.error ? ["project"] : [],
  };
}
