import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Braces,
  DatabaseZap,
  Gauge,
  GitCompareArrows,
  Play,
  ShieldAlert,
  Waypoints,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui/card";
import { getTraceAnalysis, getTraceDetail, getTraceReplay } from "@/lib/api";

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

function buildPythonReplaySnippet(traceId: string) {
  return `from reliai import replay

pipeline = replay("${traceId}")
result = pipeline.run()

print(result["steps"])`;
}

function buildNodeReplaySnippet(traceId: string) {
  return `import { replay } from "reliai";

const pipeline = await replay("${traceId}");
const result = pipeline.run();

console.log(result.steps);`;
}

function formatMoney(value: string | null) {
  if (!value) return "n/a";
  return `$${value}`;
}

function traceStatusTone(success: boolean) {
  return success
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
}

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  const trace = await getTraceDetail(traceId).catch(() => null);

  if (!trace) {
    notFound();
  }

  const [replay, analysis] = await Promise.all([
    getTraceReplay(trace.trace_id).catch(() => null),
    getTraceAnalysis(traceId).catch(() => null),
  ]);

  const pythonReplay = buildPythonReplaySnippet(trace.trace_id);
  const nodeReplay = buildNodeReplaySnippet(trace.trace_id);
  const totalTokens = (trace.prompt_tokens ?? 0) + (trace.completion_tokens ?? 0);
  const replayPayload = replay ? JSON.stringify(replay, null, 2) : null;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,1)_60%,rgba(244,244,245,0.92))] px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link href="/traces" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
                <ArrowLeft className="h-4 w-4" />
                Back to traces
              </Link>
              <p className="mt-4 text-xs uppercase tracking-[0.28em] text-steel">Trace debugging</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{trace.request_id}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                One request, broken into execution steps so an operator can see what happened, what slowed down, and where a guardrail intervened.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/traces/${trace.trace_id}/graph`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
              >
                <Waypoints className="h-4 w-4" />
                View trace graph
              </Link>
              {replay ? (
                <a
                  href="#replay"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
                >
                  <Play className="h-4 w-4" />
                  Replay this request
                </a>
              ) : null}
              {trace.compare_path ? (
                <Link
                  href={`/traces/${trace.id}/compare`}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
                >
                  <GitCompareArrows className="h-4 w-4" />
                  Compare to baseline
                </Link>
              ) : null}
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${traceStatusTone(trace.success)}`}>
                {trace.success ? "Success" : trace.error_type ?? "Failure"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <Gauge className="h-5 w-5 text-steel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-steel">Latency</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "n/a"}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <Braces className="h-5 w-5 text-steel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-steel">Prompt version</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {trace.prompt_version_record?.version ?? trace.prompt_version ?? "Unversioned"}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <ShieldAlert className="h-5 w-5 text-steel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-steel">Guardrail</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {trace.guardrail_policy ? trace.guardrail_policy.replaceAll("_", " ") : "None"}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <DatabaseZap className="h-5 w-5 text-steel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-steel">Estimated cost</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{formatMoney(trace.total_cost_usd)}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <Waypoints className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace analysis</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">What happened in this request</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Slowest step</p>
                <p className="mt-2 text-lg font-semibold text-ink">{analysis?.slowest_span?.span_name ?? "n/a"}</p>
                <p className="mt-1 text-sm text-steel">
                  {analysis?.slowest_span?.latency_ms !== null && analysis?.slowest_span?.latency_ms !== undefined
                    ? `${analysis.slowest_span.latency_ms} ms`
                    : "No span timing recorded"}
                </p>
              </div>
              <div className="rounded-[24px] border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Largest token consumer</p>
                <p className="mt-2 text-lg font-semibold text-ink">{analysis?.largest_token_span?.span_name ?? "n/a"}</p>
                <p className="mt-1 text-sm text-steel">
                  {analysis?.largest_token_span?.token_count !== null && analysis?.largest_token_span?.token_count !== undefined
                    ? `${analysis.largest_token_span.token_count} tokens`
                    : "No token-heavy span found"}
                </p>
              </div>
              <div className="rounded-[24px] border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Guardrail retries</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {analysis?.most_guardrail_retries?.guardrail_policy ?? "None recorded"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {analysis?.most_guardrail_retries?.retry_count !== null &&
                  analysis?.most_guardrail_retries?.retry_count !== undefined
                    ? `${analysis.most_guardrail_retries.retry_count} retries`
                    : "No retry-heavy span found"}
                </p>
              </div>
              <div className="rounded-[24px] border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Estimated cost</p>
                <p className="mt-2 text-lg font-semibold text-ink">{formatMoney(trace.total_cost_usd)}</p>
                <p className="mt-1 text-sm text-steel">{totalTokens} total tokens</p>
              </div>
            </div>
          </Card>

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

          {replay ? (
            <Card id="replay" className="rounded-[28px] border-zinc-300 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Replay this request locally</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Demo-friendly replay</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
                    Sanitized pipeline reconstruction for local debugging. Secrets and tokens are redacted before the replay payload is returned.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[24px] border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Python example</p>
                    <CopyButton value={pythonReplay} label="Copy Python" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">
                    {pythonReplay}
                  </pre>
                </div>
                <div className="rounded-[24px] border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Node example</p>
                    <CopyButton value={nodeReplay} label="Copy Node" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">
                    {nodeReplay}
                  </pre>
                </div>
              </div>
              <div className="mt-6 rounded-[24px] border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Replay payload</p>
                  {replayPayload ? <CopyButton value={replayPayload} label="Copy Payload" /> : null}
                </div>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-ink">
                  {replayPayload}
                </pre>
              </div>
            </Card>
          ) : (
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Replay this request locally</p>
              <div className="mt-4 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                Replay is not available for this trace yet. Once span-aware replay data is stored, this section will show ready-to-copy Python and Node snippets.
              </div>
            </Card>
          )}
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
                <dt className="text-steel">Environment</dt>
                <dd className="text-right text-ink">{trace.environment}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">Trace ID</dt>
                <dd className="text-right text-ink">{trace.trace_id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">Span name</dt>
                <dd className="text-right text-ink">{trace.span_name ?? "request"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">Guardrail action</dt>
                <dd className="text-right text-ink">
                  {trace.guardrail_policy ? `${trace.guardrail_policy} · ${trace.guardrail_action ?? "n/a"}` : "n/a"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel">User</dt>
                <dd className="text-right text-ink">{trace.user_id ?? "n/a"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Version context</p>
            <div className="mt-4 space-y-3 text-sm text-steel">
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-ink">Prompt version</p>
                <p className="mt-1">{trace.prompt_version_record?.version ?? trace.prompt_version ?? "n/a"}</p>
                {trace.prompt_version_record ? (
                  <Link
                    href={`/prompt-versions/${trace.prompt_version_record.id}?projectId=${trace.project_id}`}
                    className="mt-2 inline-flex text-sm font-medium text-ink underline-offset-4 hover:underline"
                  >
                    Open prompt detail
                  </Link>
                ) : null}
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-ink">Model route</p>
                <p className="mt-1">
                  {trace.model_version_record
                    ? `${trace.model_version_record.provider ?? "provider n/a"} / ${trace.model_version_record.model_name}${trace.model_version_record.model_version ? ` / ${trace.model_version_record.model_version}` : ""}`
                    : trace.model_name}
                </p>
              </div>
              {trace.registry_pivots.map((pivot) => (
                <a
                  key={pivot.pivot_type}
                  href={pivot.path}
                  className="block rounded-2xl border border-zinc-200 px-4 py-3 font-medium text-ink underline-offset-4 hover:underline"
                >
                  {pivot.label}
                </a>
              ))}
            </div>
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
              </dl>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">No retrieval metadata was stored for this trace.</p>
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
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${evaluationTone(evaluation.label)}`}>
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
              <p className="mt-4 text-sm leading-6 text-steel">No evaluation results have been persisted yet.</p>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Metadata</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-ink">
              {renderJson(trace.metadata_json ?? {})}
            </pre>
          </Card>
        </div>
      </section>
    </div>
  );
}
