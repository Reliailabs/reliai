import { Fragment } from "react";
import { ArrowRight, BellElectric, GitCommitHorizontal, ShieldAlert, TriangleAlert } from "lucide-react";

import type { TimelineEventRead } from "@reliai/types";

import { SubPageHeader } from "@/components/ui/sub-page-header";
import { getProject, getProjectTimeline } from "@/lib/api";

function eventIcon(eventType: string) {
  if (eventType === "incident") return ShieldAlert;
  if (eventType === "deployment") return GitCommitHorizontal;
  if (eventType === "guardrail") return BellElectric;
  if (eventType === "guardrail_runtime_enforced") return BellElectric;
  return TriangleAlert;
}

function eventTypeTone(eventType: string) {
  if (eventType === "incident") return "text-red-400";
  if (eventType === "regression") return "text-amber-400";
  if (eventType === "deployment") return "text-blue-400";
  if (eventType === "guardrail" || eventType === "guardrail_runtime_enforced") return "text-blue-400";
  return "text-zinc-500";
}

function severityBadge(severity?: string | null) {
  if (!severity) return null;
  if (severity === "critical") return "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border bg-red-500/10 text-red-400 border-red-500/30";
  if (severity === "high") return "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/30";
  if (severity === "medium") return "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  if (severity === "low") return "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border bg-blue-500/10 text-blue-400 border-blue-500/30";
  return "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
}

function eventLabel(eventType: string) {
  if (eventType === "incident") return "Incident";
  if (eventType === "deployment") return "Deployment";
  if (eventType === "guardrail") return "Guardrail";
  if (eventType === "guardrail_runtime_enforced") return "Runtime guardrail";
  return "Regression";
}

function eventLink(event: TimelineEventRead) {
  const path = typeof event.metadata?.path === "string" ? event.metadata.path : null;
  return path ?? null;
}

function eventMeta(event: TimelineEventRead) {
  return typeof event.metadata?.incident_type === "string"
    ? event.metadata.incident_type
    : typeof event.metadata?.policy_type === "string"
      ? event.metadata.policy_type
      : typeof event.metadata?.metric_name === "string"
        ? event.metadata.metric_name
        : typeof event.metadata?.action_taken === "string"
          ? event.metadata.action_taken
          : null;
}

function renderSummary(summary: string) {
  const pattern = /(\d+(?:\.\d+)?\s*->\s*\d+(?:\.\d+)?)/g;
  const parts = summary.split(pattern);
  if (parts.length === 1) return summary;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${part}-${index}`} className="font-mono text-zinc-300">
        {part}
      </span>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    )
  );
}

export default async function ProjectTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, timeline] = await Promise.all([
    getProject(id),
    getProjectTimeline(id, { environment, limit: 100 }),
  ]);

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="Investigation timeline"
        title={project.name}
        description="Unified project chronology across incidents, deployments, regressions, and triggered guardrails."
        backHref={`/projects/${id}/reliability${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
        backLabel="Back to reliability"
        right={
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-400">
            {environment ?? project.environment} · {timeline.items.length} events
          </div>
        }
      />

      {timeline.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
            <TriangleAlert className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="text-sm font-medium text-zinc-400">No timeline events yet</div>
          <div className="text-xs text-zinc-600 mt-1">Deploy a change, ingest traces, or trigger a regression to populate the investigation feed.</div>
        </div>
      ) : (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-6 shadow-sm">
          <div className="relative ml-3 border-l border-dashed border-zinc-800 pl-8">
            {timeline.items.map((event, index) => {
              const Icon = eventIcon(event.event_type);
              const href = eventLink(event);
              const meta = eventMeta(event);
              const eventTone = eventTypeTone(event.event_type);
              const severityClass = severityBadge(event.severity);
              return (
                <div key={`${event.event_type}-${event.timestamp}-${index}`} className="relative pb-6 last:pb-0">
                  <div className={`absolute -left-[43px] top-5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 ${eventTone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <article className="rounded-lg border border-zinc-800 bg-zinc-800 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{eventLabel(event.event_type)}</span>
                          {meta ? <span className="text-[10px] text-zinc-600">· {meta}</span> : null}
                        </div>
                        <h2 className="text-sm font-medium text-zinc-100">{event.title}</h2>
                        <p className="text-sm leading-6 text-zinc-500">{renderSummary(event.summary)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {severityClass ? <span className={severityClass}>{event.severity}</span> : null}
                        <p className="text-xs text-zinc-600">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {href ? (
                      <div className="mt-4">
                        <a
                          href={href}
                          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                        >
                          Open detail
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}