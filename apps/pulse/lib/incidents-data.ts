import "server-only";

import { formatDistanceToNowStrict } from "date-fns";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { IncidentSurfaceItem, IncidentSurfaceStatus, IncidentsSurfaceData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type IncidentRead = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  incident_type?: string | null;
  project_name?: string | null;
  started_at: string;
  updated_at: string;
  acknowledged_by_operator_email?: string | null;
  summary_json?: Record<string, unknown> | null;
};

type IncidentEventRead = {
  event_type: string;
  happened_at: string;
  summary: string;
};

type IncidentDetailRead = {
  id: string;
  traces: Array<{ id: string }>;
  deployment_context: { deployment: { id: string } } | null;
  compare: { trace_compare_path: string };
};

function toStatus(status: string): IncidentSurfaceStatus {
  if (status === "resolved") return "resolved";
  if (status === "acknowledged") return "mitigating";
  if (status === "open") return "investigating";
  return "monitoring";
}

function relDuration(value: string): string {
  try {
    return formatDistanceToNowStrict(new Date(value));
  } catch {
    return "unknown";
  }
}

function timeStamp(value: string): string {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
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

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "NA";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function buildFallbackTimeline(item: IncidentRead) {
  return [
    { time: timeStamp(item.started_at), event: "Alert triggered", type: "alert" as const },
    { time: timeStamp(item.updated_at), event: "Incident status updated", type: "action" as const },
  ];
}

export async function getIncidentsSurfaceData(): Promise<IncidentsSurfaceData> {
  const sourceErrors: string[] = [];
  const incidentsResult = await safeFetch(apiRequest<{ items: IncidentRead[] }>("/api/v1/incidents?limit=25"));
  if (incidentsResult.error) sourceErrors.push("incidents");

  const incidents = incidentsResult.data?.items ?? [];
  const mapped: IncidentSurfaceItem[] = [];

  for (const item of incidents.slice(0, 12)) {
    const eventsResult = await safeFetch(
      apiRequest<{ items: IncidentEventRead[] }>(`/api/v1/incidents/${item.id}/events`),
    );
    if (eventsResult.error) sourceErrors.push(`incident-events:${item.id}`);
    const timeline =
      eventsResult.data?.items?.length
        ? eventsResult.data.items.slice(0, 4).map((event) => ({
            time: timeStamp(event.happened_at),
            event: event.summary,
            type:
              event.event_type.includes("ack") || event.event_type.includes("notify")
                ? ("notification" as const)
                : event.event_type.includes("resolve")
                  ? ("action" as const)
                  : ("alert" as const),
          }))
        : buildFallbackTimeline(item);

    const detailResult = await safeFetch(
      apiRequest<IncidentDetailRead>(`/api/v1/incidents/${item.id}`),
    );
    if (detailResult.error) sourceErrors.push(`incident-detail:${item.id}`);

    const detail = detailResult.data;
    const summary = item.summary_json ?? {};
    const sampleTraceIds = Array.isArray(summary.sample_trace_ids)
      ? (summary.sample_trace_ids as string[]).filter(Boolean)
      : [];
    const regressionCount = typeof summary.regression_count === "number" ? summary.regression_count : 0;
    const failureRateDelta =
      typeof summary.failure_rate_delta_pct === "number" ? summary.failure_rate_delta_pct : null;
    const contributingFactors: string[] = [];
    if (regressionCount > 0) {
      contributingFactors.push(`${regressionCount} regression signal${regressionCount === 1 ? "" : "s"} observed.`);
    }
    if (failureRateDelta !== null) {
      contributingFactors.push(`Failure rate changed by ${failureRateDelta.toFixed(1)}%.`);
    }
    if (detail?.deployment_context?.deployment.id) {
      contributingFactors.push("Incident overlaps a recent deployment window.");
    }
    if (contributingFactors.length === 0) {
      contributingFactors.push("Insufficient linked evidence in current incident snapshot.");
    }

    const evidenceLinks: Array<{ label: string; href: string }> = [];
    if (detail?.compare?.trace_compare_path) {
      evidenceLinks.push({ label: "Trace compare", href: detail.compare.trace_compare_path });
    }
    if (detail?.deployment_context?.deployment.id) {
      evidenceLinks.push({
        label: "Linked deployment",
        href: `/deployments#${detail.deployment_context.deployment.id}`,
      });
    }
    if (sampleTraceIds.length > 0 || (detail?.traces.length ?? 0) > 0) {
      evidenceLinks.push({ label: "Trace samples", href: "/traces" });
    }
    evidenceLinks.push({ label: "Related errors", href: "/errors" });

    let confidence: IncidentSurfaceItem["intelligence"]["confidence"] = "insufficient";
    if (contributingFactors.length >= 3 || (detail?.deployment_context?.deployment.id && sampleTraceIds.length > 0)) {
      confidence = "high";
    } else if (contributingFactors.length >= 2 || sampleTraceIds.length > 0) {
      confidence = "medium";
    } else if (contributingFactors[0] !== "Insufficient linked evidence in current incident snapshot.") {
      confidence = "low";
    }

    const assignee = item.acknowledged_by_operator_email ?? "Unassigned";
    mapped.push({
      id: item.id,
      title: item.title,
      description:
        (item.summary_json?.description as string | undefined) ??
        `${item.incident_type ?? "reliability"} issue in ${item.project_name ?? "project"}`,
      severity: item.severity,
      status: toStatus(item.status),
      duration: relDuration(item.started_at),
      assignee,
      assigneeInitials: initials(assignee === "Unassigned" ? "UA" : assignee),
      impactedServices: [item.project_name ?? "Unknown service"],
      timeline,
      intelligence: {
        contributingFactors,
        confidence,
        evidenceLinks,
        requiresOperatorReview: true,
      },
    });
  }

  return {
    incidents: mapped,
    sourceErrors: Array.from(new Set(sourceErrors)),
    dataMode: "live",
  };
}
