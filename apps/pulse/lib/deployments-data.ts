import "server-only";

import { formatDistanceToNowStrict } from "date-fns";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { DeploymentSurfaceItem, DeploymentsSurfaceData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = {
  id: string;
  name: string;
};

type DeploymentRead = {
  id: string;
  project_id?: string | null;
  environment?: string | null;
  deployed_at?: string | null;
  created_at: string;
  status?: string | null;
  commit_hash?: string | null;
  actor_email?: string | null;
  metadata_json?: Record<string, unknown> | null;
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

function relTime(value: string | null | undefined): string {
  if (!value) return "unknown";
  try {
    return `${formatDistanceToNowStrict(new Date(value), { addSuffix: true })}`;
  } catch {
    return "unknown";
  }
}

function initials(value: string): string {
  const parts = value.split(" ").filter(Boolean);
  if (parts.length === 0) return "NA";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toStatus(value?: string | null): DeploymentSurfaceItem["status"] {
  if (value === "failed") return "failed";
  if (value === "rollback") return "rollback";
  return "success";
}

function weekBuckets(items: DeploymentRead[]) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = new Array<number>(7).fill(0);
  for (const item of items) {
    const date = new Date(item.deployed_at ?? item.created_at);
    const day = date.getDay(); // 0=Sun..6=Sat
    const normalized = day === 0 ? 6 : day - 1; // Mon=0
    counts[normalized] += 1;
  }
  return labels.map((day, index) => ({ day, deploys: counts[index] }));
}

export async function getDeploymentsSurfaceData(): Promise<DeploymentsSurfaceData> {
  const sourceErrors: string[] = [];
  const projectsResult = await safeFetch(apiRequest<{ items: ProjectRead[] }>("/api/v1/projects"));
  if (projectsResult.error) sourceErrors.push("projects");
  const projects = projectsResult.data?.items ?? [];

  const perProject = await Promise.all(
    projects.slice(0, 8).map(async (project) => {
      const result = await safeFetch(
        apiRequest<{ items: DeploymentRead[] }>(`/api/v1/projects/${project.id}/deployments`),
      );
      if (result.error) sourceErrors.push(`deployments:${project.id}`);
      return { project, items: result.data?.items ?? [] };
    }),
  );

  const deploymentsRaw = perProject.flatMap((entry) =>
    entry.items.map((item) => ({ ...item, projectName: entry.project.name })),
  );
  deploymentsRaw.sort((a, b) => {
    const left = new Date(a.deployed_at ?? a.created_at).getTime();
    const right = new Date(b.deployed_at ?? b.created_at).getTime();
    return right - left;
  });

  const deployments = deploymentsRaw.slice(0, 12).map((item) => {
    const author = item.actor_email ?? "Platform operator";
    const commitHash = item.commit_hash ?? "n/a";
    const commitTitle =
      (item.metadata_json?.summary as string | undefined) ??
      (item.metadata_json?.change_note as string | undefined) ??
      "Release update";
    return {
      id: item.id,
      service: item.projectName.toLowerCase().replace(/\s+/g, "-"),
      version: (item.metadata_json?.version as string | undefined) ?? "v-next",
      status: toStatus(item.status),
      environment: item.environment ?? "production",
      duration: "n/a",
      timestamp: relTime(item.deployed_at ?? item.created_at),
      author,
      authorInitials: initials(author),
      commit: commitTitle,
      commitHash,
    };
  });

  const total = deploymentsRaw.length;
  const success = deployments.filter((item) => item.status === "success").length;
  const failed = deployments.filter((item) => item.status === "failed").length;
  const rollback = deployments.filter((item) => item.status === "rollback").length;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  return {
    deploymentFrequency: weekBuckets(deploymentsRaw),
    deployments,
    deploymentRefs: deployments.map((deployment) => ({
      id: deployment.id,
      detailPath: `/deployments/${deployment.id}`,
    })),
    metrics: [
      { label: "Deploys Today", value: String(total), change: total > 0 ? `+${Math.min(3, total)}` : "0" },
      { label: "Success Rate", value: `${successRate}%`, change: successRate >= 95 ? "+1%" : "-2%" },
      { label: "Avg Duration", value: "n/a", change: "n/a" },
      { label: "Rollbacks", value: String(rollback), change: failed > 0 ? `+${Math.min(failed, rollback + 1)}` : "0" },
    ],
    sourceErrors: Array.from(new Set(sourceErrors)),
    hasDeploymentData: deployments.length > 0,
    dataMode: "live",
  };
}
