import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LimitStatusInlineSlot } from "@/components/system/limit-status-inline-slot";
import { getTraceCompare } from "@/lib/api";

function renderMetadata(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return "No scalar metadata differences";
  }
  return Object.entries(value)
    .map(([key, item]) => {
      const diff = item as { current?: string | null; baseline?: string | null };
      return `${key}: ${diff.current ?? "—"} vs ${diff.baseline ?? "—"}`;
    })
    .join(" · ");
}

function TraceCard({
  trace,
  label,
  incidentSuffix,
}: {
  trace: Awaited<ReturnType<typeof getTraceCompare>>["pairs"][number]["current_trace"];
  label: string;
  incidentSuffix: string;
}) {
  const incidentId = incidentSuffix.replace("?incident_id=", "");
  const traceHref = trace
    ? incidentId
      ? { pathname: `/traces/${trace.id}`, query: { incident_id: incidentId } }
      : { pathname: `/traces/${trace.id}` }
    : { pathname: "/traces" };
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">{label}</p>
      {trace ? (
        <div className="mt-3 space-y-3 text-sm text-secondary">
          {trace.payload_truncated ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>Trace truncated — full payload not stored.</p>
              <p className="mt-1 text-[11px] text-amber-800">Some evidence may be missing due to payload size limits.</p>
            </div>
          ) : null}
          <div>
            <p className="font-medium text-primary">{trace.request_id}</p>
            <Link
              href={traceHref}
              className="mt-1 inline-block underline-offset-4 hover:underline"
            >
              Open trace
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <p>Model · {trace.model_name}</p>
            <p>Prompt · {trace.prompt_version ?? "—"}</p>
            <p>Status · {trace.success ? "success" : trace.error_type ?? "failure"}</p>
            <p>Latency · {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "—"}</p>
            <p>Prompt tokens · {trace.prompt_tokens ?? "—"}</p>
            <p>Completion tokens · {trace.completion_tokens ?? "—"}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-secondary">No baseline peer was found for this trace.</p>
      )}
    </div>
  );
}

export default async function TraceComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ traceId: string }>;
  searchParams: Promise<{ incident_id?: string }>;
}) {
  const { traceId } = await params;
  const { incident_id: incidentId } = await searchParams;
  const incidentSuffix = typeof incidentId === "string" ? `?incident_id=${incidentId}` : "";
  const compare = await getTraceCompare(traceId).catch(() => null);

  if (!compare) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={
                incidentId
                  ? { pathname: `/traces/${traceId}`, query: { incident_id: incidentId } }
                  : `/traces/${traceId}`
              }
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-secondary hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to trace
            </Link>
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Trace compare</p>
              <h1 className="mt-2 text-lg font-semibold text-primary">Baseline versus current trace</h1>
              <p className="mt-1 text-sm text-secondary">
                Differences are ordered first to accelerate root-cause confirmation.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-secondary">
            {compare.scope_type}:{compare.scope_id}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <LimitStatusInlineSlot projectId={compare.project_id} types={["sampling"]} />
          <div className="rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-6 text-sm text-secondary">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-secondary">Trace window</p>
                <p className="mt-1 text-sm font-semibold text-primary">{compare.current_window_start ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-secondary">Baseline window</p>
                <p className="mt-1 text-sm font-semibold text-primary">{compare.baseline_window_start ?? "—"}</p>
                <p className="text-xs text-secondary">{compare.baseline_window_end ?? "—"}</p>
              </div>
            </div>
          </div>

          {compare.pairs.map((pair) => {
            const diffBlocks = [...pair.diff_blocks].sort((a, b) => Number(b.changed) - Number(a.changed));
            return (
              <div key={pair.pair_index} className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <TraceCard trace={pair.current_trace} label="Current trace" incidentSuffix={incidentSuffix} />
                  <TraceCard trace={pair.baseline_trace} label="Baseline peer" incidentSuffix={incidentSuffix} />
                </div>
                <div className="rounded-2xl border border-line bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-secondary">Focused differences</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {diffBlocks.map((block) => (
                      <div
                        key={block.block_type}
                        className={`rounded-lg border px-3 py-2 ${
                          block.changed ? "border-error/40 bg-errorBg text-primary" : "border-line bg-surfaceAlt text-secondary"
                        }`}
                      >
                        <p className="text-sm font-medium text-primary">{block.title}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-secondary">
                          {block.changed ? "Changed" : "No change"}
                        </p>
                        {block.metadata_json ? (
                          <p className="mt-2 text-sm text-secondary">{renderMetadata(block.metadata_json)}</p>
                        ) : (
                          <div className="mt-2 space-y-1 text-sm text-secondary">
                            <p>Current · {block.current_value ?? "—"}</p>
                            <p>Baseline · {block.baseline_value ?? "—"}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Version context</p>
            <div className="mt-4 space-y-3">
              {compare.prompt_version_contexts.map((context) => (
                <a
                  key={context.id}
                  href={context.traces_path}
                  className="block rounded-lg border border-line bg-surfaceAlt px-3 py-2 text-sm font-medium text-primary transition hover:border-textSecondary"
                >
                  Prompt {context.version} · current {context.current_count ?? 0} / baseline {context.baseline_count ?? 0}
                </a>
              ))}
              {compare.model_version_contexts.map((context) => (
                <a
                  key={context.id}
                  href={context.traces_path}
                  className="block rounded-lg border border-line bg-surfaceAlt px-3 py-2 text-sm font-medium text-primary transition hover:border-textSecondary"
                >
                  {context.provider ?? "provider —"} / {context.model_name}
                  {context.model_version ? ` / ${context.model_version}` : ""}
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Trace pivots</p>
            <div className="mt-4 space-y-3">
              {compare.cohort_pivots.map((pivot) => (
                <a
                  key={pivot.pivot_type}
                  href={pivot.path}
                  className="block rounded-lg border border-line bg-surfaceAlt px-3 py-2 text-sm font-medium text-primary transition hover:border-textSecondary"
                >
                  {pivot.label}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
