import "server-only";

import { formatDistanceToNowStrict } from "date-fns";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { ServiceCard, ServicesSurfaceData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = {
  id: string;
  name: string;
};

type ProjectReliabilityRead = {
  slos?: {
    safe_completion_rate?: number | null;
  } | null;
  incidents?: {
    open?: number | null;
    critical_open?: number | null;
  } | null;
  guardrails?: {
    violation_rate?: number | null;
  } | null;
  traces?: {
    p95_latency_ms?: number | null;
    total?: number | null;
  } | null;
  deployments?: {
    latest?: {
      deployed_at?: string | null;
      version?: string | null;
    } | null;
  } | null;
};

function relTime(value: string | null | undefined): string {
  if (!value) return "unknown";
  try {
    return `${formatDistanceToNowStrict(new Date(value), { addSuffix: true })}`;
  } catch {
    return "unknown";
  }
}

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

function statusFromReliability(detail: ProjectReliabilityRead): ServiceCard["status"] {
  const criticalOpen = detail.incidents?.critical_open ?? 0;
  const open = detail.incidents?.open ?? 0;
  const safeCompletion = detail.slos?.safe_completion_rate ?? 1;
  if (criticalOpen > 0) return "down";
  if (open > 0 || safeCompletion < 0.96) return "degraded";
  return "healthy";
}

export async function getServicesSurfaceData(projectId?: string): Promise<ServicesSurfaceData> {
  const sourceErrors: string[] = [];
  const selected: ProjectRead[] = [];
  if (projectId) {
    const scopedProjectResult = await safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`));
    if (scopedProjectResult.error) {
      sourceErrors.push("projects");
    } else if (scopedProjectResult.data) {
      selected.push(scopedProjectResult.data);
    }
  } else {
    const projectsResult = await safeFetch(apiRequest<{ items: ProjectRead[] }>("/api/v1/projects"));
    if (projectsResult.error) {
      sourceErrors.push("projects");
    } else {
      selected.push(...(projectsResult.data?.items ?? []).slice(0, 8));
    }
  }

  const details = await Promise.all(
    selected.map(async (project) => {
      const result = await safeFetch(apiRequest<ProjectReliabilityRead>(`/api/v1/projects/${project.id}/reliability`));
      if (result.error || !result.data) {
        sourceErrors.push(`reliability:${project.id}`);
      }
      return { project, detail: result.data };
    }),
  );

  const services: ServiceCard[] = details.map(({ project, detail }) => {
    const status = detail ? statusFromReliability(detail) : "maintenance";
    const uptimePct = Math.max(0, Math.min(100, Math.round((detail?.slos?.safe_completion_rate ?? 0.99) * 10000) / 100));
    const requests = detail?.traces?.total ?? 0;
    const latency = detail?.traces?.p95_latency_ms ?? 0;
    const errorRate = Math.max(0, 100 - uptimePct).toFixed(2);
    return {
      name: project.name.toLowerCase().replace(/\s+/g, "-"),
      description: `${project.name} reliability surface`,
      status,
      version: detail?.deployments?.latest?.version ?? "n/a",
      uptime: `${uptimePct.toFixed(2)}%`,
      requests: `${requests}/24h`,
      errorRate: `${errorRate}%`,
      latency: `${latency}ms`,
      team: "AI Reliability",
      repo: "internal",
      lastDeploy: relTime(detail?.deployments?.latest?.deployed_at),
    };
  });

  return {
    services,
    sourceErrors: Array.from(new Set(sourceErrors)),
    dataMode: "live",
  };
}
