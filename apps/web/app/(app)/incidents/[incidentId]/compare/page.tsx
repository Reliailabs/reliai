import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getIncidentTraceCompare } from "@/lib/api";

function renderMetadata(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return "n/a";
  }
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${String(item)}`)
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
    <div className="rounded-[24px] border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-steel">{label}</p>
      {trace ? (
        <div className="mt-3 space-y-3 text-sm text-steel">
          <div>
            <p className="font-medium text-ink">{trace.request_id}</p>
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
            <p className="font-medium text-ink">Retrieval</p>
            <p className="mt-1">
              {trace.retrieval
                ? `${trace.retrieval.retrieval_latency_ms ?? "n/a"} ms · ${trace.retrieval.source_count ?? "n/a"} sources · top_k ${trace.retrieval.top_k ?? "n/a"}`
                : "n/a"}
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Metadata excerpt</p>
            <p className="mt-1">{renderMetadata(trace.metadata_excerpt_json)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-steel">No representative trace for this slot.</p>
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
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link
          href={`/incidents/${incidentId}`}
          className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to incident
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace compare</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Representative current vs baseline traces
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
              Side-by-side compare for the traces chosen from the current incident window and its baseline window.
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

      <section className="space-y-4">
        {compare.pairs.map((pair) => (
          <div key={pair.pair_index} className="grid gap-4 xl:grid-cols-2">
            <TraceCompareCard trace={pair.current_trace} label={`Current #${pair.pair_index + 1}`} />
            <TraceCompareCard trace={pair.baseline_trace} label={`Baseline #${pair.pair_index + 1}`} />
          </div>
        ))}
      </section>
    </div>
  );
}
