import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Braces, DatabaseZap, Gauge, MessagesSquare } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getTraceDetail } from "@/lib/api";

function renderJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function evaluationTone(label: string | null) {
  switch (label) {
    case "pass":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "fail":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
}

export default async function TraceDetailPage({
  params
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  const trace = await getTraceDetail(traceId).catch(() => null);

  if (!trace) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/traces" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to traces
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">{trace.request_id}</h1>
          <p className="mt-2 text-sm text-steel">
            {trace.model_name} · {trace.environment} · {new Date(trace.timestamp).toLocaleString()}
          </p>
        </div>
        <div
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            trace.success
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
          }`}
        >
          {trace.success ? "Success" : trace.error_type ?? "Failure"}
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <Gauge className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Latency</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "n/a"}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <Braces className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Prompt version</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{trace.prompt_version ?? "Unversioned"}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <MessagesSquare className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Tokens</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {(trace.prompt_tokens ?? 0) + (trace.completion_tokens ?? 0)}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <DatabaseZap className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Estimated cost</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {trace.total_cost_usd ?? "n/a"}
          </p>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Input</p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-ink">
              {trace.input_text ?? "No input captured"}
            </pre>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Output</p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">
              {trace.output_text ?? "No output captured"}
            </pre>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Metadata</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-ink">
              {renderJson(trace.metadata_json ?? {})}
            </pre>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Request context</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-steel">Project</dt>
                <dd className="text-right text-ink">{trace.project_id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">Organization</dt>
                <dd className="text-right text-ink">{trace.organization_id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">User</dt>
                <dd className="text-right text-ink">{trace.user_id ?? "n/a"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">Session</dt>
                <dd className="text-right text-ink">{trace.session_id ?? "n/a"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Retrieval span</p>
            {trace.retrieval_span ? (
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-steel">Latency</dt>
                  <dd className="text-ink">
                    {trace.retrieval_span.retrieval_latency_ms ?? "n/a"}
                    {trace.retrieval_span.retrieval_latency_ms !== null ? " ms" : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-steel">Sources</dt>
                  <dd className="text-ink">{trace.retrieval_span.source_count ?? "n/a"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-steel">Top K</dt>
                  <dd className="text-ink">{trace.retrieval_span.top_k ?? "n/a"}</dd>
                </div>
                <div>
                  <dt className="text-steel">Query</dt>
                  <dd className="mt-2 rounded-2xl bg-zinc-50 p-3 text-ink">
                    {trace.retrieval_span.query_text ?? "n/a"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">
                No retrieval metadata was stored for this trace.
              </p>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Evaluations</p>
            {trace.evaluations.length > 0 ? (
              <div className="mt-4 space-y-4">
                {trace.evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{evaluation.eval_type}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${evaluationTone(
                          evaluation.label
                        )}`}
                      >
                        {evaluation.label ?? "pending"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-steel">{evaluation.explanation}</p>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-zinc-50 p-3 text-xs leading-5 text-ink">
                      {renderJson(evaluation.raw_result_json ?? {})}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">
                No evaluation results have been persisted yet.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
