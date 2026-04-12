import Link from "next/link";
import { ArrowLeft, ArrowRight, BellElectric, Clock3, Shield, TriangleAlert } from "lucide-react";

import { getProject, getProjectGuardrailMetrics } from "@/lib/api";

function formatTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function actionTone(action: string) {
  if (action === "block") return "bg-rose-950 text-rose-300 ring-1 ring-rose-800";
  if (action === "fallback_model") return "bg-amber-950 text-amber-300 ring-1 ring-amber-800";
  if (action === "retry") return "bg-sky-950 text-sky-300 ring-1 ring-sky-800";
  return "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800";
}

export default async function ProjectGuardrailsPage({
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
  const [project, guardrailMetrics] = await Promise.all([
    getProject(id),
    getProjectGuardrailMetrics(id, environment),
  ]);

  const totalTriggers = guardrailMetrics.policies.reduce((sum, policy) => sum + policy.trigger_count, 0);
  const activePolicies = guardrailMetrics.policies.length;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-sm">
        <div className="border-b border-zinc-800 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0))] px-6 py-5">
          <Link
            href={`/projects/${id}${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project dashboard
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Guardrail dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Inspect runtime guardrail coverage, trigger volume, and the actions currently protecting
                production traffic.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Policies</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{activePolicies}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Triggers</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{totalTriggers}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Environment</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{environment ?? project.environment}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <Shield className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Protection coverage</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Policies with zero triggers still appear here so operators can verify what is active before a
                failure path is exercised.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <BellElectric className="mt-0.5 h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Runtime focus</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                This dashboard reflects enforced runtime events, not offline policy simulation.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 px-6 pb-5">
          <Link
            href={`/projects/${id}/metrics`}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Manage custom metrics
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/projects/${id}/ingestion`}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Manage ingestion policy
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Guardrail performance</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Policy trigger summary</h2>
          </div>
        </div>
        {guardrailMetrics.policies.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-5 py-10 text-sm leading-6 text-zinc-400">
            No guardrail policies are configured for this project yet. Create structured output, cost, latency,
            or hallucination policies before expecting runtime protection coverage.
            <Link
              href={`/projects/${id}/metrics`}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200 hover:underline"
            >
              Manage custom metrics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800 text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Policy type</th>
                  <th className="px-4 py-3 font-medium">Trigger count</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Last triggered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {guardrailMetrics.policies.map((policy) => (
                  <tr key={policy.policy_id} className="align-top">
                    <td className="px-4 py-4 font-medium text-zinc-100">{policy.policy_type}</td>
                    <td className="px-4 py-4 text-zinc-100">{policy.trigger_count}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${actionTone(policy.action)}`}>
                        {policy.action}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{formatTime(policy.last_triggered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Span guardrail analytics</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Guardrail usage in execution traces</h2>
          </div>
        </div>
        {guardrailMetrics.trace_policy_counts.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-5 py-10 text-sm leading-6 text-zinc-400">
            No span-level guardrail annotations have been ingested yet. SDK runtime guardrails will appear here once
            distributed traces start sending first-class guardrail fields.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {guardrailMetrics.trace_policy_counts.map((item) => (
              <div key={item.policy_type} className="rounded-[24px] border border-zinc-800 bg-zinc-900 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.policy_type}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{item.trigger_count}</p>
                <p className="mt-1 text-sm text-zinc-400">annotated spans</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent guardrail events</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Latest enforcement activity</h2>
          </div>
        </div>
        {guardrailMetrics.recent_events.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-5 py-10 text-sm leading-6 text-zinc-400">
            No runtime guardrail events have been recorded yet. Enforced retries, blocks, and fallbacks will
            appear here once production traffic exercises those policies.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {guardrailMetrics.recent_events.map((event) => {
              const body = (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Policy</p>
                    <p className="mt-1 text-sm font-medium text-zinc-100">{event.policy_type}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Action</p>
                    <p className="mt-1 text-sm font-medium text-zinc-100">{event.action_taken}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Model</p>
                    <p className="mt-1 text-sm font-medium text-zinc-100">{event.provider_model ?? "n/a"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Latency</p>
                    <p className="mt-1 text-sm font-medium text-zinc-100">
                      {event.latency_ms === null ? "n/a" : `${event.latency_ms}ms`}
                    </p>
                  </div>
                </div>
              );

              return (
                <div key={`${event.trace_id}-${event.created_at}`} className="rounded-[24px] border border-zinc-800 bg-zinc-900 px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-zinc-800 p-2 text-zinc-300">
                        {event.action_taken === "block" ? (
                          <TriangleAlert className="h-4 w-4" />
                        ) : (
                          <BellElectric className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{formatTime(event.created_at)}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          Trace reference{" "}
                          {event.trace_available ? (
                            <Link
                              href={`/traces/${event.trace_id}`}
                              className="font-medium text-zinc-200 underline-offset-4 hover:underline"
                            >
                              {event.trace_id}
                            </Link>
                          ) : (
                            <span className="font-medium text-zinc-200">{event.trace_id}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {event.trace_available ? (
                      <Link
                        href={`/traces/${event.trace_id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200 hover:text-zinc-100"
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
      </div>
    </div>
  );
}