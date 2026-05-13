import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = {
  id: string;
  name: string;
  environment?: string | null;
};

type MetadataCardinalityRead = {
  field_name: string;
  unique_values_count: number;
  limit_reached: boolean;
};

type TraceIngestionPolicyRead = {
  project_id: string;
  environment_id: string | null;
  sampling_success_rate: number;
  sampling_error_rate: number;
  max_metadata_fields: number;
  max_cardinality_per_field: number;
  retention_days_success: number;
  retention_days_error: number;
  created_at: string;
  sensitive_field_patterns: string[];
  cardinality_summary: MetadataCardinalityRead[];
};

export type ProjectIngestionSurfaceData = {
  projectId: string;
  projectName: string;
  environment: string;
  policy: TraceIngestionPolicyRead | null;
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

export async function getProjectIngestionSurfaceData(projectId: string): Promise<ProjectIngestionSurfaceData> {
  const sourceErrors: string[] = [];

  const [projectResult, policyResult] = await Promise.all([
    safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`)),
    safeFetch(apiRequest<TraceIngestionPolicyRead>(`/api/v1/projects/${projectId}/ingestion-policy`)),
  ]);

  if (projectResult.error) sourceErrors.push("project");
  if (policyResult.error) sourceErrors.push("project-ingestion-policy");

  return {
    projectId,
    projectName: projectResult.data?.name ?? "Project",
    environment: projectResult.data?.environment ?? "unknown",
    policy: policyResult.data,
    sourceErrors: Array.from(new Set(sourceErrors)),
  };
}
