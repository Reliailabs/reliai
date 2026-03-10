import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getRegressionCompare } from "@/lib/api";

function renderMetadata(value: Record<string, unknown> | null) {
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

function TraceCard({
  trace,
  label,
}: {
  trace: Awaited<ReturnType<typeof getRegressionCompare>>["pairs"][number]["current_trace"];
  label: string;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-steel">{label}</p>
      {trace ? (
        <div className="mt-3 space-y-3 text-sm text-steel">
          <div>
            <p className="font-medium text-ink">{trace.request_id}</p>
            <Link href={`/traces/${trace.id}`} className="mt-1 inline-block underline-offset-4 hover:underline">
              Open trace
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <p>Model · {trace.model_name}</p>
            <p>Prompt · {trace.prompt_version ?? "n/a"}</p>
            <p>Status · {trace.success ? "success" : trace.error_type ?? "failure"}</p>
            <p>Latency · {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "n/a"}</p>
            <p>Prompt tokens · {trace.prompt_tokens ?? "n/a"}</p>
            <p>Completion tokens · {trace.completion_tokens ?? "n/a"}</p>
            <p>Cost · {trace.total_cost_usd ?? "n/a"}</p>
            <p>
              Structured output ·{" "}
              {trace.structured_output
                ? `${trace.structured_output.label ?? "n/a"}${trace.structured_output.reason ? ` · ${trace.structured_output.reason}` : ""}`
                : "n/a"}
            </p>
          </div>
          <p>
            Retrieval ·{" "}
            {trace.retrieval
              ? `${trace.retrieval.retrieval_latency_ms ?? "n/a"} ms · ${trace.retrieval.source_count ?? "n/a"} sources · top_k ${trace.retrieval.top_k ?? "n/a"}`
              : "n/a"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-steel">No representative trace for this slot.</p>
      )}
    </div>
  );
}

export default async function RegressionComparePage({
  params,
}: {
  params: Promise<{ regressionId: string }>;
}) {
  const { regressionId } = await params;
  const compare = await getRegressionCompare(regressionId).catch(() => null);

  if (!compare) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link
          href={`/regressions/${regressionId}`}
          className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to regression
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Regression compare</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Representative current vs baseline traces
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
              Regression-led compare with explicit current and baseline pairs, focused diff blocks, and trace pivots.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {compare.metric_name ?? "metric n/a"} · {compare.scope_type ?? "scope"}:{compare.scope_id ?? "n/a"}
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <GitCompareArrows className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Current window</p>
          <p className="mt-2 text-sm font-medium text-ink">{compare.current_window_start ?? "n/a"}</p>
          <p className="mt-1 text-sm text-steel">{compare.current_window_end ?? "n/a"}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <GitCompareArrows className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Baseline window</p>
          <p className="mt-2 text-sm font-medium text-ink">{compare.baseline_window_start ?? "n/a"}</p>
          <p className="mt-1 text-sm text-steel">{compare.baseline_window_end ?? "n/a"}</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Dimension summaries</p>
          <div className="mt-4 space-y-3">
            {compare.dimension_summaries.map((summary, index) => (
              <div key={`${summary.summary_type}-${index}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">{summary.summary_type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-sm text-steel">
                  {summary.dimension}
                  {summary.current_value ? ` · current ${summary.current_value}` : ""}
                  {summary.baseline_value ? ` · baseline ${summary.baseline_value}` : ""}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {summary.current_share ? `current share ${summary.current_share}` : ""}
                  {summary.baseline_share ? ` · baseline share ${summary.baseline_share}` : ""}
                  {summary.delta_value ? ` · delta ${summary.delta_value}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace pivots</p>
          <div className="mt-4 space-y-3">
            {compare.cohort_pivots.map((pivot) => (
              <a
                key={pivot.pivot_type}
                href={pivot.path}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-ink transition hover:bg-zinc-50"
              >
                {pivot.label}
              </a>
            ))}
            {compare.related_incident_id ? (
              <Link
                href={`/incidents/${compare.related_incident_id}`}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-ink transition hover:bg-zinc-50"
              >
                Open related incident
              </Link>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Prompt version context</p>
          <div className="mt-4 space-y-3">
            {compare.prompt_version_contexts.map((context) => (
              <div key={context.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">{context.version}</p>
                <p className="mt-1 text-sm text-steel">
                  current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <a href={context.traces_path} className="text-ink underline-offset-4 hover:underline">Traces</a>
                  <a href={context.regressions_path} className="text-ink underline-offset-4 hover:underline">Regressions</a>
                  <a href={context.incidents_path} className="text-ink underline-offset-4 hover:underline">Incidents</a>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Model version context</p>
          <div className="mt-4 space-y-3">
            {compare.model_version_contexts.map((context) => (
              <div key={context.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">
                  {context.provider ?? "provider n/a"} / {context.model_name}
                  {context.model_version ? ` / ${context.model_version}` : ""}
                </p>
                <p className="mt-1 text-sm text-steel">
                  current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                </p>
                <a href={context.traces_path} className="mt-2 inline-block text-sm text-ink underline-offset-4 hover:underline">
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
              <TraceCard trace={pair.current_trace} label={`Current #${pair.pair_index + 1}`} />
              <TraceCard trace={pair.baseline_trace} label={`Baseline #${pair.pair_index + 1}`} />
            </div>
            <Card className="rounded-[24px] border-zinc-300 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Focused differences</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pair.diff_blocks.map((block) => (
                  <div key={block.block_type} className="rounded-2xl border border-zinc-200 px-4 py-3">
                    <p className="text-sm font-medium text-ink">{block.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">
                      {block.changed ? "Changed" : "No change"}
                    </p>
                    {block.metadata_json ? (
                      <p className="mt-2 text-sm text-steel">{renderMetadata(block.metadata_json)}</p>
                    ) : (
                      <div className="mt-2 space-y-1 text-sm text-steel">
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
    </div>
  );
}
