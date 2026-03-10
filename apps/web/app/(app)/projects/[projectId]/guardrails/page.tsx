import Link from "next/link";
import { ArrowLeft, ArrowRight, BellElectric, Clock3, Shield, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getProject, getProjectGuardrailMetrics } from "@/lib/api";

function formatTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function actionTone(action: string) {
  if (action === "block") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (action === "fallback_model") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (action === "retry") return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export default async function ProjectGuardrailsPage({
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
  const [project, guardrailMetrics] = await Promise.all([
    getProject(projectId),
    getProjectGuardrailMetrics(projectId, environment),
  ]);

  const totalTriggers = guardrailMetrics.policies.reduce((sum, policy) => sum + policy.trigger_count, 0);
  const activePolicies = guardrailMetrics.policies.length;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(15,23,42,0))] px-6 py-5">
          <a
            href={`/projects/${projectId}/control${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
            className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to control panel
          </a>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrail dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                Inspect runtime guardrail coverage, trigger volume, and the actions currently protecting
                production traffic.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Policies</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{activePolicies}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Triggers</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{totalTriggers}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Environment</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{environment ?? project.environment}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <Shield className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-ink">Protection coverage</p>
              <p className="mt-1 text-sm leading-6 text-steel">
                Policies with zero triggers still appear here so operators can verify what is active before a
                failure path is exercised.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <BellElectric className="mt-0.5 h-5 w-5 text-sky-700" />
            <div>
              <p className="text-sm font-medium text-ink">Runtime focus</p>
              <p className="mt-1 text-sm leading-6 text-steel">
                This dashboard reflects enforced runtime events, not offline policy simulation.
              </p>
            </div>
          </div>
        </div>
      </header>

      <Card className="rounded-[28px] border-zinc-300 p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-steel" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrail performance</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Policy trigger summary</h2>
          </div>
        </div>
        {guardrailMetrics.policies.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-sm leading-6 text-steel">
            No guardrail policies are configured for this project yet. Create structured output, cost, latency,
            or hallucination policies before expecting runtime protection coverage.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.18em] text-steel">
                <tr>
                  <th className="px-4 py-3 font-medium">Policy type</th>
                  <th className="px-4 py-3 font-medium">Trigger count</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Last triggered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {guardrailMetrics.policies.map((policy) => (
                  <tr key={policy.policy_id} className="align-top">
                    <td className="px-4 py-4 font-medium text-ink">{policy.policy_type}</td>
                    <td className="px-4 py-4 text-ink">{policy.trigger_count}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${actionTone(policy.action)}`}>
                        {policy.action}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-steel">{formatTime(policy.last_triggered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="rounded-[28px] border-zinc-300 p-6">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-steel" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent guardrail events</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Latest enforcement activity</h2>
          </div>
        </div>
        {guardrailMetrics.recent_events.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-sm leading-6 text-steel">
            No runtime guardrail events have been recorded yet. Enforced retries, blocks, and fallbacks will
            appear here once production traffic exercises those policies.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {guardrailMetrics.recent_events.map((event) => {
              const body = (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-steel">Policy</p>
                    <p className="mt-1 text-sm font-medium text-ink">{event.policy_type}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-steel">Action</p>
                    <p className="mt-1 text-sm font-medium text-ink">{event.action_taken}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-steel">Model</p>
                    <p className="mt-1 text-sm font-medium text-ink">{event.provider_model ?? "n/a"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-steel">Latency</p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {event.latency_ms === null ? "n/a" : `${event.latency_ms}ms`}
                    </p>
                  </div>
                </div>
              );

              return (
                <div key={`${event.trace_id}-${event.created_at}`} className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-zinc-100 p-2 text-zinc-700">
                        {event.action_taken === "block" ? (
                          <TriangleAlert className="h-4 w-4" />
                        ) : (
                          <BellElectric className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-steel">{formatTime(event.created_at)}</p>
                        <p className="mt-1 text-sm text-steel">
                          Trace reference{" "}
                          {event.trace_available ? (
                            <Link
                              href={`/traces/${event.trace_id}`}
                              className="font-medium text-ink underline-offset-4 hover:underline"
                            >
                              {event.trace_id}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink">{event.trace_id}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {event.trace_available ? (
                      <Link
                        href={`/traces/${event.trace_id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-slate-700"
                      >
                        Open trace
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-4">{body}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
