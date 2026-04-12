import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, GitCompareArrows } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getMetricDisplayName } from "@/components/presenters/ops-format";
import { LimitStatusInlineSlot } from "@/components/system/limit-status-inline-slot";
import { getIncidentTraceCompare } from "@/lib/api";

function renderMetadata(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return "n/a";
  }
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(" · ");
}

function renderDiffMetadata(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return "No scalar metadata differences";
  }
  return Object.entries(value)
    .map(([key, item]) => {
      const diff = item as { current?: string | null; baseline?: string | null };
      return `${key}: ${diff.current ?? "n/a"} vs ${diff.baseline ?? "n/a"}`;
    })
    .join(" · ");
}

function renderStructured(trace: {
  structured_output: { label: string | null; reason: string | null } | null;
}) {
  if (!trace.structured_output) {
    return "n/a";
  }
  return `${trace.structured_output.label ?? "n/a"}${trace.structured_output.reason ? ` · ${trace.structured_output.reason}` : ""}`;
}

function TraceCompareCard({
  trace,
  label,
}: {
  trace: Awaited<ReturnType<typeof getIncidentTraceCompare>>["pairs"][number]["current_trace"];
  label: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      {trace ? (
        <div className="mt-3 space-y-3 text-sm text-zinc-400">
          {trace.payload_truncated ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <p>Trace truncated — full payload not stored.</p>
              <p className="mt-1 text-[11px] text-amber-400">Some evidence may be missing due to payload size limits.</p>
            </div>
          ) : null}
          <div>
            <p className="font-medium text-zinc-100">{trace.request_id}</p>
            <p className="mt-1">
              <Link href={`/traces/${trace.id}`} className="underline-offset-4 hover:underline">
                Open trace
              </Link>
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <p>Model · {trace.model_name}</p>
            <p>Prompt · {trace.prompt_version ?? "n/a"}</p>
            <p>Status · {trace.success ? "success" : trace.error_type ?? "failure"}</p>
            <p>Latency · {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "n/a"}</p>
            <p>Prompt tokens · {trace.prompt_tokens ?? "n/a"}</p>
            <p>Completion tokens · {trace.completion_tokens ?? "n/a"}</p>
            <p>Cost · {trace.total_cost_usd ?? "n/a"}</p>
            <p>Structured output · {renderStructured(trace)}</p>
          </div>
          <div>
            <p className="font-medium text-zinc-100">Refusal signal</p>
            <div className="mt-1">
              {trace.refusal_detected === null ? (
                <span className="text-sm text-zinc-400">n/a</span>
              ) : trace.refusal_detected ? (
                <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 ring-1 ring-rose-500/20">
                  Refusal detected
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                  Not detected
                </span>
              )}
            </div>
          </div>
          {(trace.custom_metric_results ?? []).length > 0 ? (
            <div>
              <p className="font-medium text-zinc-100">Custom metrics</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(trace.custom_metric_results ?? []).map((item) => (
                  <span
                    key={item.metric_key ?? item.name}
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                      item.matched
                        ? "bg-rose-500/10 text-rose-400 ring-rose-500/20"
                        : "bg-zinc-900 text-zinc-500 ring-zinc-800"
                    }`}
                  >
                    {item.matched ? "Triggered: " : ""}{item.name}
                    {item.mode === "count" && item.matched ? ` (${item.value})` : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="font-medium text-zinc-100">Retrieval</p>
            <p className="mt-1">
              {trace.retrieval
                ? `${trace.retrieval.retrieval_latency_ms ?? "n/a"} ms · ${trace.retrieval.source_count ?? "n/a"} sources · top_k ${trace.retrieval.top_k ?? "n/a"}`
                : "n/a"}
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-100">Metadata excerpt</p>
            <p className="mt-1">{renderMetadata(trace.metadata_excerpt_json)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">No representative trace for this slot.</p>
      )}
    </div>
  );
}

export default async function IncidentComparePage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const compare = await getIncidentTraceCompare(incidentId).catch(() => null);

  if (!compare) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-6 shadow-sm">
        <Link
          href={`/incidents/${incidentId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to incident
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Trace compare</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
              Representative current vs baseline traces
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
              Side-by-side compare for the traces chosen from the current incident window and its baseline window.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            {getMetricDisplayName(compare.metric_name)} · {compare.scope_type ?? "scope"}:{compare.scope_id ?? "n/a"}
          </div>
        </div>
      </header>

      <LimitStatusInlineSlot projectId={compare.project_id} types={["sampling"]} />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg p-5">
          <GitCompareArrows className="h-5 w-5 text-zinc-400" />
          <p className="mt-3 text-sm text-zinc-400">Current window</p>
          <p className="mt-2 text-sm font-medium text-zinc-100">{compare.current_window_start ?? "n/a"}</p>
          <p className="mt-1 text-sm text-zinc-400">{compare.current_window_end ?? "n/a"}</p>
        </Card>
        <Card className="rounded-lg p-5">
          <GitCompareArrows className="h-5 w-5 text-zinc-400" />
          <p className="mt-3 text-sm text-zinc-400">Baseline window</p>
          <p className="mt-2 text-sm font-medium text-zinc-100">{compare.baseline_window_start ?? "n/a"}</p>
          <p className="mt-1 text-sm text-zinc-400">{compare.baseline_window_end ?? "n/a"}</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Dimension summaries</p>
          <div className="mt-4 space-y-3">
            {compare.dimension_summaries.map((summary, index) => (
              <div key={`${summary.summary_type}-${index}`} className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{summary.summary_type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {summary.dimension}
                  {summary.current_value ? ` · current ${summary.current_value}` : ""}
                  {summary.baseline_value ? ` · baseline ${summary.baseline_value}` : ""}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {summary.current_share ? `current share ${summary.current_share}` : ""}
                  {summary.baseline_share ? ` · baseline share ${summary.baseline_share}` : ""}
                  {summary.delta_value ? ` · delta ${summary.delta_value}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Trace pivots</p>
          <div className="mt-4 space-y-3">
            {compare.cohort_pivots.map((pivot) => (
              <a
                key={pivot.pivot_type}
                href={pivot.path}
                className="block rounded-lg border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
              >
                {pivot.label}
              </a>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Prompt version context</p>
          <div className="mt-4 space-y-3">
            {compare.prompt_version_contexts.map((context) => (
              <div key={context.id} className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{context.version}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <a href={context.traces_path} className="text-zinc-100 underline-offset-4 hover:underline">Traces</a>
                  <a href={context.regressions_path} className="text-zinc-100 underline-offset-4 hover:underline">Regressions</a>
                  <a href={context.incidents_path} className="text-zinc-100 underline-offset-4 hover:underline">Incidents</a>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Model version context</p>
          <div className="mt-4 space-y-3">
            {compare.model_version_contexts.map((context) => (
              <div key={context.id} className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">
                  {context.provider ?? "provider n/a"} / {context.model_name}
                  {context.model_version ? ` / ${context.model_version}` : ""}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                </p>
                <a href={context.traces_path} className="mt-2 inline-block text-sm text-zinc-100 underline-offset-4 hover:underline">
                  Traces
                </a>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        {compare.pairs.map((pair) => (
          <div key={pair.pair_index} className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <TraceCompareCard trace={pair.current_trace} label={`Current #${pair.pair_index + 1}`} />
              <TraceCompareCard trace={pair.baseline_trace} label={`Baseline #${pair.pair_index + 1}`} />
            </div>
        <Card className="rounded-lg p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Focused differences</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pair.diff_blocks.map((block) => (
                  <div key={block.block_type} className="rounded-lg border border-zinc-800 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-100">{block.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                      {block.changed ? "Changed" : "No change"}
                    </p>
                    {block.metadata_json ? (
                      <p className="mt-2 text-sm text-zinc-400">{renderDiffMetadata(block.metadata_json)}</p>
                    ) : (
                      <div className="mt-2 space-y-1 text-sm text-zinc-400">
                        <p>Current · {block.current_value ?? "n/a"}</p>
                        <p>Baseline · {block.baseline_value ?? "n/a"}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))}
      </section>

      {compare.pairs.some((p) =>
        [p.current_trace, p.baseline_trace].some((t) =>
          (t?.custom_metric_results ?? []).some((m) => m.matched),
        ),
      ) ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10/60 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-400">Behavioral signal</p>
          <p className="mt-2 text-sm font-medium text-amber-400">
            Custom metrics triggered in this comparison
          </p>
          <p className="mt-1 text-sm text-amber-400">
            Track additional behavior patterns or adjust your existing metrics.
          </p>
          <Link
            href={`/projects/${compare.project_id}/metrics`}
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 hover:text-amber-400"
          >
            Manage custom metrics
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}