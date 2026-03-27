import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows, Play, Waypoints } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { RecommendationCallout } from "@/components/ui/recommendation-callout";
import { Button } from "@/components/ui/button";
import { MetadataBar, MetadataItem } from "@/components/ui/metadata-bar";
import { getTraceAnalysis, getTraceCompare, getTraceDetail, getTraceGraph, getTraceReplay, listProjectCustomMetrics } from "@/lib/api";
import { buildComparison, extractMetrics } from "@/lib/trace-compare-engine";

function renderJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function evaluationTone(label: string | null) {
  switch (label) {
    case "pass":
    case "miss":
      return "bg-successBg text-success ring-1 ring-success/30";
    case "fail":
    case "hit":
      return "bg-errorBg text-error ring-1 ring-error/30";
    default:
      return "bg-warningBg text-warning ring-1 ring-warning/30";
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
  if (!value) return "—";
  return `$${value}`;
}

function traceStatusTone(success: boolean) {
  return success
    ? "bg-successBg text-success ring-1 ring-success/30"
    : "bg-errorBg text-error ring-1 ring-error/30";
}

export default async function TraceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ traceId: string }>;
  searchParams: Promise<{ incident_id?: string }>;
}) {
  const { traceId } = await params;
  const { incident_id: incidentId } = await searchParams;
  const incidentQuery = typeof incidentId === "string" ? { incident_id: incidentId } : undefined;
  const trace = await getTraceDetail(traceId).catch(() => null);

  if (!trace) {
    notFound();
  }

  const [replay, analysis, compare, customMetricsResponse] = await Promise.all([
    getTraceReplay(trace.trace_id).catch(() => null),
    getTraceAnalysis(traceId).catch(() => null),
    getTraceCompare(traceId).catch(() => null),
    listProjectCustomMetrics(trace.project_id).catch(() => ({ items: [] }))
  ]);

  const pythonReplay = buildPythonReplaySnippet(trace.trace_id);
  const nodeReplay = buildNodeReplaySnippet(trace.trace_id);
  const customMetricResults = trace.custom_metric_results ?? [];
  const totalTokens = (trace.prompt_tokens ?? 0) + (trace.completion_tokens ?? 0);
  const refusalEval = trace.evaluations.find((e) => e.eval_type === "refusal_detection");
  const refusalMatchedPattern =
    (refusalEval?.raw_result_json?.matched_pattern as string | undefined) ?? null;
  const hasRefusalMetric = customMetricsResponse.items.some((metric) =>
    /(refusal)/i.test(metric.name) || /(refusal)/i.test(metric.metric_key)
  );
  const hasPolicyMetric = customMetricsResponse.items.some((metric) =>
    /(policy)/i.test(metric.name) || /(policy)/i.test(metric.metric_key)
  );
  const policyEval = trace.evaluations.find((e) =>
    e.eval_type.toLowerCase().includes("policy") ||
    (e.label ? e.label.toLowerCase().includes("policy") : false)
  );
  const showRefusalMetricCta = trace.refusal_detected === true && !hasRefusalMetric;
  const showPolicyMetricCta = Boolean(policyEval) && !hasPolicyMetric;
  const replayPayload = replay ? JSON.stringify(replay, null, 2) : null;
  const comparePair = compare?.pairs?.[0] ?? null;
  const baselineTraceId = comparePair?.baseline_trace?.id ?? null;
  const [currentGraph, baselineGraph] = await Promise.all([
    getTraceGraph(trace.trace_id).catch(() => null),
    baselineTraceId ? getTraceGraph(baselineTraceId).catch(() => null) : Promise.resolve(null),
  ]);
  const comparison =
    currentGraph && baselineGraph
      ? buildComparison(
          extractMetrics(currentGraph.nodes),
          extractMetrics(baselineGraph.nodes)
        )
      : [];

  const orderedSteps =
    currentGraph?.nodes
      ?.slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) ?? [];
  const slowestLatency = analysis?.slowest_span?.latency_ms ?? null;
  const slowestShare =
    slowestLatency && trace.latency_ms ? Math.round((slowestLatency / trace.latency_ms) * 100) : null;
  const tokenTotal = totalTokens;
  const tokenShare =
    analysis?.largest_token_span?.token_count && tokenTotal
      ? Math.round((analysis.largest_token_span.token_count / tokenTotal) * 100)
      : null;
  const keyFindings = [
    analysis?.slowest_span
      ? {
          id: analysis.slowest_span.span_id,
          label: "Slowest step",
          detail: `${analysis.slowest_span.span_name ?? "Span"} · ${analysis.slowest_span.latency_ms ?? 0} ms`,
          rationale: slowestShare ? `Accounts for ${slowestShare}% of trace latency.` : "Largest latency contribution in this trace.",
        }
      : null,
    analysis?.largest_token_span
      ? {
          id: analysis.largest_token_span.span_id,
          label: "Token spike",
          detail: `${analysis.largest_token_span.span_name ?? "Span"} · ${analysis.largest_token_span.token_count ?? 0} tokens`,
          rationale: tokenShare ? `Accounts for ${tokenShare}% of total tokens.` : "Largest token contribution in this trace.",
        }
      : null,
    analysis?.most_guardrail_retries
      ? {
          id: analysis.most_guardrail_retries.span_id,
          label: "Guardrail retries",
          detail: `${analysis.most_guardrail_retries.guardrail_policy ?? "Guardrail"} · ${analysis.most_guardrail_retries.retry_count ?? 0} retries`,
          rationale: "Highest retry concentration in the trace graph.",
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; detail: string; rationale: string }>;
  const maxDuration = Math.max(...orderedSteps.map((node) => node.latency_ms ?? 0), 1);
  const hasInputs = Boolean(trace.input_text);
  const hasOutputs = Boolean(trace.output_text);

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={incidentQuery ? { pathname: "/traces", query: incidentQuery } : "/traces"}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-steel hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to traces
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold text-ink">{trace.request_id}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${traceStatusTone(trace.success)}`}>
                {trace.success ? "Healthy" : trace.error_type ?? "Failure"}
              </span>
            </div>
            <p className="mt-1 text-sm text-steel">
              Trace debugging · {trace.environment} · {trace.created_at}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={
                  incidentQuery
                    ? { pathname: `/traces/${trace.trace_id}/graph`, query: incidentQuery }
                    : `/traces/${trace.trace_id}/graph`
                }
              >
                <Waypoints className="mr-2 h-4 w-4" />
                Graph
              </Link>
            </Button>
            {replay ? (
              <Button asChild variant="outline" size="sm">
                <Link href="#replay">
                  <Play className="mr-2 h-4 w-4" />
                  Replay
                </Link>
              </Button>
            ) : null}
            {trace.compare_path ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={
                    incidentQuery
                      ? { pathname: trace.compare_path, query: incidentQuery }
                      : (trace.compare_path as Route)
                  }
                >
                  <GitCompareArrows className="mr-2 h-4 w-4" />
                  Compare
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-6 text-sm text-steel">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-steel">Latency</p>
                <p className="mt-1 text-sm font-semibold text-ink">{trace.latency_ms ?? "—"} ms</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-steel">Tokens</p>
                <p className="mt-1 text-sm font-semibold text-ink">{totalTokens}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-steel">Cost</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatMoney(trace.total_cost_usd)}</p>
              </div>
              {trace.guardrail_policy ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-steel">Guardrail</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {trace.guardrail_policy} · {trace.guardrail_action ?? "—"}
                  </p>
                </div>
              ) : null}
              {trace.refusal_detected !== null ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-steel">Refusal signal</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                      trace.refusal_detected
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    }`}
                  >
                    {trace.refusal_detected ? "Detected" : "Not detected"}
                  </span>
                  {trace.refusal_detected && refusalMatchedPattern ? (
                    <p className="mt-1 max-w-[200px] truncate text-xs text-steel">
                      <span className="font-mono">{refusalMatchedPattern}</span>
                    </p>
                  ) : null}
                  {showRefusalMetricCta ? (
                    <Button asChild size="sm" variant="outline" className="mt-2 rounded-full">
                      <Link
                        href={`/projects/${trace.project_id}/metrics?template=refusal_language&keywords=${encodeURIComponent(
                          refusalMatchedPattern ?? ""
                        )}&source=trace`}
                      >
                        Track refusal as a metric
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {keyFindings.length > 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Key findings</p>
              <div className="mt-4 space-y-3">
                {keyFindings.map((item) => (
                  <a
                    key={`${item.id}-${item.label}`}
                    href={`#span-${item.id}`}
                    className="block rounded-lg border border-line bg-surfaceAlt px-3 py-2 text-sm text-ink transition hover:border-textSecondary"
                  >
                    <span className="text-[11px] uppercase tracking-[0.2em] text-steel">{item.label}</span>
                    <p className="mt-1 font-medium">{item.detail}</p>
                    <p className="mt-1 text-xs text-steel">{item.rationale}</p>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-steel">No critical findings detected in this trace.</p>
          )}

          <div className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace breakdown</p>
            </div>
            <div className="divide-y divide-line">
              {orderedSteps.map((span) => {
                const attrs = (span.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
                  ?.attributes;
                const statusTone = span.success ? "bg-success" : "bg-error";
                const duration = span.latency_ms ?? 0;
                const width = Math.max((duration / maxDuration) * 100, 4);
                return (
                  <details key={span.span_id} id={`span-${span.span_id}`} className="group px-5 py-4">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm text-ink">
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${statusTone}`} />
                        <span className="font-medium">{span.span_name ?? "Span"}</span>
                        {span.span_type ? (
                          <span className="text-xs uppercase tracking-[0.2em] text-steel">{span.span_type}</span>
                        ) : null}
                      </div>
                      <span className="text-xs text-steel">{duration} ms</span>
                    </summary>
                    <div className="mt-3 h-2 w-full rounded bg-surfaceAlt">
                      <div className={`h-2 rounded ${statusTone}`} style={{ width: `${width}%` }} />
                    </div>
                    <div className="mt-3 grid gap-3 text-xs text-steel md:grid-cols-2">
                      {span.prompt_tokens !== null || span.completion_tokens !== null ? (
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-steel">Tokens</p>
                          <p className="mt-1 text-sm text-ink">
                            {(span.prompt_tokens ?? 0) + (span.completion_tokens ?? 0)}
                          </p>
                        </div>
                      ) : null}
                      {span.guardrail_policy ? (
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-steel">Guardrail</p>
                          <p className="mt-1 text-sm text-ink">
                            {span.guardrail_policy} · {span.guardrail_action ?? "—"}
                          </p>
                        </div>
                      ) : null}
                      {attrs ? (
                        <div className="md:col-span-2">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-steel">Attributes</p>
                          <pre className="mt-2 max-h-40 overflow-x-auto rounded-lg border border-line bg-surfaceAlt p-3 text-xs text-textPrimary">
                            {renderJson(attrs)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          {hasInputs || hasOutputs ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {hasInputs ? (
                <div className="rounded-2xl border border-line bg-surface px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Input</p>
                  <pre className="mt-3 max-h-56 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surfaceAlt p-3 text-xs text-textPrimary">
                    {trace.input_text}
                  </pre>
                </div>
              ) : null}
              {hasOutputs ? (
                <div className="rounded-2xl border border-line bg-surface px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Output</p>
                  <pre className="mt-3 max-h-56 overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs text-textPrimary">
                    {trace.output_text}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}

          {replay ? (
            <div id="replay" className="rounded-2xl border border-line bg-surface px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Replay this request locally</p>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-line bg-surfaceAlt p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Python example</p>
                    <CopyButton value={pythonReplay} label="Copy Python" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs text-textPrimary">{pythonReplay}</pre>
                </div>
                <div className="rounded-lg border border-line bg-surfaceAlt p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Node example</p>
                    <CopyButton value={nodeReplay} label="Copy Node" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs text-textPrimary">{nodeReplay}</pre>
                </div>
              </div>
              {replayPayload ? (
                <div className="mt-4 rounded-lg border border-line bg-surfaceAlt p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Replay payload</p>
                    <CopyButton value={replayPayload} label="Copy Payload" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs text-textPrimary">
                    {replayPayload}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Request context</p>
            <MetadataBar className="mt-4">
              <MetadataItem label="Project" value={trace.project_id} mono truncate />
              <MetadataItem label="Environment" value={trace.environment} />
              <MetadataItem label="Trace" value={trace.trace_id} mono truncate />
              <MetadataItem label="Span" value={trace.span_name ?? "request"} />
              {trace.guardrail_policy ? (
                <MetadataItem
                  label="Guardrail"
                  value={`${trace.guardrail_policy} · ${trace.guardrail_action ?? "—"}`}
                />
              ) : null}
              <MetadataItem
                label="Status"
                value={trace.success ? "Success" : trace.error_type ?? "Failure"}
                status={trace.success ? "success" : "critical"}
              />
              {trace.user_id ? <MetadataItem label="User" value={trace.user_id} mono /> : null}
            </MetadataBar>
          </div>

          {comparison.length > 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Compared to baseline</p>
              <ul className="mt-4 space-y-2 text-sm text-steel">
                {comparison.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Version context</p>
            <div className="mt-4 space-y-3 text-sm text-steel">
              {trace.prompt_version_record ? (
                <div className="rounded-lg border border-line bg-surfaceAlt px-3 py-2">
                  <p className="font-medium text-ink">Prompt version</p>
                  <p className="mt-1">{trace.prompt_version_record.version}</p>
                </div>
              ) : null}
              <div className="rounded-lg border border-line bg-surfaceAlt px-3 py-2">
                <p className="font-medium text-ink">Model route</p>
                <p className="mt-1">
                  {trace.model_version_record
                    ? `${trace.model_version_record.provider ?? "unknown provider"} / ${trace.model_version_record.model_name}${
                        trace.model_version_record.model_version ? ` / ${trace.model_version_record.model_version}` : ""
                      }`
                    : trace.model_name}
                </p>
              </div>
              {trace.registry_pivots.map((pivot) => (
                <a
                  key={pivot.pivot_type}
                  href={pivot.path}
                  className="block rounded-lg border border-line bg-surfaceAlt px-3 py-2 font-medium text-ink underline-offset-4 hover:underline"
                >
                  {pivot.label}
                </a>
              ))}
            </div>
          </div>

          {trace.retrieval_span ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Retrieval span</p>
              <dl className="mt-4 space-y-3 text-sm text-steel">
                <div className="flex justify-between gap-4">
                  <dt>Latency</dt>
                  <dd className="text-ink">
                    {trace.retrieval_span.retrieval_latency_ms ?? "—"}
                    {trace.retrieval_span.retrieval_latency_ms !== null ? " ms" : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Sources</dt>
                  <dd className="text-ink">{trace.retrieval_span.source_count ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Top K</dt>
                  <dd className="text-ink">{trace.retrieval_span.top_k ?? "—"}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {trace.evaluations.length > 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Evaluations</p>
              <div className="mt-4 space-y-3">
                {trace.evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="rounded-lg border border-line bg-surfaceAlt p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{evaluation.eval_type}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${evaluationTone(evaluation.label)}`}>
                        {evaluation.label ?? "pending"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-steel">{evaluation.explanation}</p>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs text-textPrimary">
                      {renderJson(evaluation.raw_result_json ?? {})}
                    </pre>
                  </div>
                ))}
              </div>
              {showPolicyMetricCta ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3 text-sm text-amber-900">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Behavioral signal</p>
                  <p className="mt-2 font-semibold">Create metric from this behavior</p>
                  <p className="mt-1 text-sm">
                    Track policy violations as a custom metric in Reliability and incidents.
                  </p>
                  <div className="mt-2">
                    <Button asChild size="sm" variant="outline" className="rounded-full border-amber-300 text-amber-900 hover:bg-amber-50">
                      <Link
                        href={`/projects/${trace.project_id}/metrics?name=Policy%20violation&metric_type=regex&pattern=${encodeURIComponent(
                          policyEval?.raw_result_json?.matched_pattern
                            ? String(policyEval.raw_result_json.matched_pattern)
                            : ""
                        )}&source=trace`}
                      >
                        Create policy metric
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {customMetricResults.length > 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Custom metrics</p>
              <div className="mt-4 space-y-3">
                {customMetricResults.map((result) => (
                  <div key={`${result.metric_key ?? result.name}-${result.mode}`} className="rounded-lg border border-line bg-surfaceAlt p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{result.name}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${result.matched ? "bg-errorBg text-error ring-error/30" : "bg-successBg text-success ring-success/30"}`}>
                        {result.matched ? "triggered" : "no match"}
                      </span>
                    </div>
                    {result.mode === "count" ? (
                      <p className="mt-2 text-sm text-steel">
                        {result.matched
                          ? `${result.value} match${Number(result.value) === 1 ? "" : "es"}`
                          : "No matches found"}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-steel">
                        {result.matched ? "Pattern triggered in output" : "No match in output"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Metadata</p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-bg p-3 text-xs text-textPrimary">
              {renderJson(trace.metadata_json ?? {})}
            </pre>
          </div>
        </aside>
      </section>

      <div className="mx-auto max-w-[1400px] px-6">
          <RecommendationCallout
            label="Recommendation"
            recommendation="Consider focusing on the slowest or failing step, then compare it against baseline behavior."
            supporting="Use the baseline comparison to confirm the regression path before taking rollback action."
          />
      </div>
    </div>
  );
}
