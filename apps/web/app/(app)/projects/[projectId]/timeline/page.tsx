import Link from "next/link";
import { ArrowLeft, ArrowRight, BellElectric, GitCommitHorizontal, ShieldAlert, TriangleAlert } from "lucide-react";

import type { TimelineEventRead } from "@reliai/types";

import { Card } from "@/components/ui/card";
import { getProject, getProjectTimeline } from "@/lib/api";

function eventIcon(eventType: string) {
  if (eventType === "incident") return ShieldAlert;
  if (eventType === "deployment") return GitCommitHorizontal;
  if (eventType === "guardrail") return BellElectric;
  if (eventType === "guardrail_runtime_enforced") return BellElectric;
  return TriangleAlert;
}

function tone(event: TimelineEventRead) {
  if (event.severity === "critical") return "border-rose-300 bg-rose-50/70 text-rose-700";
  if (event.severity === "high") return "border-orange-300 bg-orange-50/70 text-orange-700";
  if (event.severity === "medium") return "border-amber-300 bg-amber-50/70 text-amber-800";
  if (event.event_type === "deployment") return "border-sky-300 bg-sky-50/70 text-sky-700";
  if (event.event_type === "guardrail_runtime_enforced") return "border-fuchsia-300 bg-fuchsia-50/70 text-fuchsia-700";
  return "border-zinc-300 bg-zinc-50 text-zinc-700";
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
  const parts = [eventLabel(event.event_type)];
  const eventSpecific =
    typeof event.metadata?.incident_type === "string"
      ? event.metadata.incident_type
      : typeof event.metadata?.policy_type === "string"
        ? event.metadata.policy_type
        : typeof event.metadata?.metric_name === "string"
          ? event.metadata.metric_name
          : typeof event.metadata?.action_taken === "string"
            ? event.metadata.action_taken
            : null;
  if (eventSpecific) parts.push(eventSpecific);
  return parts.join(" · ");
}

export default async function ProjectTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, timeline] = await Promise.all([
    getProject(projectId),
    getProjectTimeline(projectId, 100, environment),
  ]);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <a
          href={`/projects/${projectId}/reliability${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
          className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to reliability
        </a>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Investigation timeline</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Unified project chronology across incidents, deployments, regressions, and triggered guardrails.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {environment ?? project.environment} · {timeline.items.length} events
          </div>
        </div>
      </header>

      {timeline.items.length === 0 ? (
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-sm leading-6 text-steel">
            No timeline events yet. Deploy a change, ingest traces, or trigger a regression to populate the investigation feed.
          </p>
        </Card>
      ) : (
        <section className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
          <div className="relative ml-3 border-l border-dashed border-zinc-300 pl-8">
            {timeline.items.map((event, index) => {
              const Icon = eventIcon(event.event_type);
              const href = eventLink(event);
              return (
                <div key={`${event.event_type}-${event.timestamp}-${index}`} className="relative pb-6 last:pb-0">
                  <div className={`absolute -left-[43px] top-5 flex h-7 w-7 items-center justify-center rounded-full border ${tone(event)}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <article className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-steel">{eventMeta(event)}</p>
                        <h2 className="text-lg font-semibold text-ink">{event.title}</h2>
                        <p className="text-sm leading-6 text-steel">{event.summary}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {event.severity ? (
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${tone(event)}`}>
                            {event.severity}
                          </span>
                        ) : null}
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-steel">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {href ? (
                      <div className="mt-4">
                        <a
                          href={href}
                          className="inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-4 hover:text-steel hover:underline"
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
