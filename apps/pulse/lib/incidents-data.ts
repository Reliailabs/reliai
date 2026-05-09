import "server-only";

import { formatDistanceToNowStrict } from "date-fns";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { IncidentSurfaceItem, IncidentSurfaceStatus, IncidentsSurfaceData } from "@/components/dashboard/pulse-types";
import { confidenceFromEvidenceCount, OPERATOR_INTELLIGENCE_COPY } from "@/lib/operator-intelligence";

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
  traces: Array<{ id: string; processor_result_id?: string | null }>;
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
    const detailTraceCount = detail?.traces.length ?? 0;
    const deploymentId = detail?.deployment_context?.deployment.id ?? null;
    const comparePath = detail?.compare?.trace_compare_path ?? null;
    const traceErrorSignals = (detail?.traces ?? []).filter((trace) => trace.processor_result_id).length;
    const contributingFactors: string[] = [];
    if (regressionCount > 0) {
      contributingFactors.push(`${regressionCount} regression signal${regressionCount === 1 ? "" : "s"} observed.`);
    }
    if (failureRateDelta !== null) {
      contributingFactors.push(`Failure rate changed by ${failureRateDelta.toFixed(1)}%.`);
    }
    if (deploymentId) {
      contributingFactors.push("Incident overlaps a recent deployment window.");
    }
    if (detailTraceCount > 0) {
      contributingFactors.push(`Linked trace sample set contains ${detailTraceCount} trace${detailTraceCount === 1 ? "" : "s"}.`);
    }
    if (traceErrorSignals > 0) {
      contributingFactors.push(`${traceErrorSignals} linked trace${traceErrorSignals === 1 ? "" : "s"} include processor error signals.`);
    }

    const evidenceLinks: Array<{ label: string; href: string }> = [];
    if (comparePath) {
      evidenceLinks.push({ label: "Trace compare", href: comparePath });
    }
    if (deploymentId) {
      evidenceLinks.push({
        label: "Linked deployment",
        href: `/deployments#${deploymentId}`,
      });
    }
    if (sampleTraceIds.length > 0 || detailTraceCount > 0) {
      evidenceLinks.push({ label: "Trace samples", href: "/traces" });
    }
    if (traceErrorSignals > 0) {
      evidenceLinks.push({ label: "Related errors", href: "/errors" });
    }

    const concreteEvidenceCount = evidenceLinks.length;
    if (contributingFactors.length === 0 || concreteEvidenceCount === 0) {
      contributingFactors.length = 0;
      contributingFactors.push(OPERATOR_INTELLIGENCE_COPY.insufficientEvidence);
    }
    const confidence: IncidentSurfaceItem["intelligence"]["confidence"] =
      contributingFactors[0] === OPERATOR_INTELLIGENCE_COPY.insufficientEvidence
        ? "insufficient"
        : confidenceFromEvidenceCount(concreteEvidenceCount);

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
