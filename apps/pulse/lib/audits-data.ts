import "server-only";

import { formatDistanceToNowStrict } from "date-fns";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { AuditsSurfaceData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type AuditListItem = {
  audit: {
    id: string;
    name: string;
    updated_at: string;
  };
  latest_run?: {
    status?: string | null;
    certification_status?: string | null;
  } | null;
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

function relTime(value: string): string {
  try {
    return `${formatDistanceToNowStrict(new Date(value), { addSuffix: true })}`;
  } catch {
    return "recently";
  }
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return (parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "");
}

function toSeverity(status?: string | null, cert?: string | null): "critical" | "high" | "medium" | "low" {
  if (status === "failed" || cert === "fail") return "critical";
  if (cert === "conditional") return "high";
  if (status === "running" || status === "needs_review") return "medium";
  return "low";
}

export async function getAuditsSurfaceData(): Promise<AuditsSurfaceData> {
  const sourceErrors: string[] = [];
  const auditsResult = await safeFetch(apiRequest<{ items: AuditListItem[] }>("/api/v1/audits"));
  if (auditsResult.error) sourceErrors.push("audits");

  const items = auditsResult.data?.items ?? [];
  const completed = items.filter((item) => item.latest_run?.status === "completed").length;
  const failed = items.filter((item) => item.latest_run?.status === "failed").length;
  const conditional = items.filter((item) => item.latest_run?.certification_status === "conditional").length;

  return {
    responseTimeData: [
      { week: "W1", ack: 2.4, resolve: 44 },
      { week: "W2", ack: 2.1, resolve: 41 },
      { week: "W3", ack: 1.9, resolve: 39 },
      { week: "W4", ack: 2.2, resolve: 43 },
    ],
    currentSchedule: [
      { name: "Audit Review Lead", initials: "AR", role: "Primary", shift: "Current cycle", status: "active" },
      { name: "Reliability Lead", initials: "RL", role: "Secondary", shift: "Current cycle", status: "standby" },
      { name: "Compliance Lead", initials: "CL", role: "Upcoming", shift: "Next cycle", status: "upcoming" },
    ],
    recentPages: items.slice(0, 8).map((item) => {
      const runStatus = item.latest_run?.status ?? "queued";
      const certStatus = item.latest_run?.certification_status ?? "pending";
      const severity = toSeverity(runStatus, certStatus);
      return {
        id: item.audit.id,
        title: item.audit.name,
        severity,
        acknowledged: runStatus !== "queued",
        ackTime: runStatus === "running" ? "in progress" : runStatus === "completed" ? "completed" : "queued",
        assignee: "Audit Team",
        timestamp: relTime(item.audit.updated_at),
        resolved: runStatus === "completed" && certStatus === "pass",
      };
    }),
    metrics: [
      { label: "Completed Runs", value: String(completed), change: completed > 0 ? `+${Math.min(3, completed)}` : "0", good: true },
      { label: "Conditional Certs", value: String(conditional), change: conditional > 0 ? `+${conditional}` : "0", good: conditional === 0 },
      { label: "Failed Runs", value: String(failed), change: failed > 0 ? `+${failed}` : "0", good: failed === 0 },
      { label: "Total Audits", value: String(items.length), change: items.length > 0 ? `+${Math.min(2, items.length)}` : "0", good: true },
    ],
    sourceErrors: Array.from(new Set(sourceErrors)),
    hasAuditData: items.length > 0,
    dataMode: "live",
  };
}
