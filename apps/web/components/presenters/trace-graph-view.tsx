import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Braces,
  Search,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Wrench,
} from "lucide-react";

import type { TraceGraphAnalysisRead, TraceGraphRead } from "@reliai/types";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function spanDepth(spanId: string, parentByChild: Map<string, string | null>) {
  let depth = 0;
  let current = parentByChild.get(spanId) ?? null;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = parentByChild.get(current) ?? null;
  }
  return depth;
}

function normalizeSpanType(spanType: string | null | undefined, spanName: string | null | undefined) {
  const value = (spanType ?? spanName ?? "request").toLowerCase();
  if (value === "prompt_build") return "prompt_build";
  if (value === "llm_call") return "llm_call";
  if (value === "tool_call") return "tool_call";
  if (value === "postprocess") return "postprocess";
  if (value === "retrieval") return "retrieval";
  if (value === "guardrail") return "guardrail";
  return "request";
}

function spanLabel(spanType: string) {
  if (spanType === "prompt_build") return "prompt build";
  if (spanType === "llm_call") return "llm call";
  if (spanType === "tool_call") return "tool call";
  return spanType.replaceAll("_", " ");
}

function spanTone(spanType: string) {
  switch (spanType) {
    case "retrieval":
      return "border-sky-300 bg-sky-50 text-sky-900";
    case "prompt_build":
      return "border-indigo-300 bg-indigo-50 text-indigo-900";
    case "llm_call":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "tool_call":
      return "border-orange-300 bg-orange-50 text-orange-900";
    case "postprocess":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "guardrail":
      return "border-rose-300 bg-rose-50 text-rose-900";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-800";
  }
}

function spanIcon(spanType: string) {
  switch (spanType) {
    case "retrieval":
      return Search;
    case "prompt_build":
      return Braces;
    case "llm_call":
      return Bot;
    case "tool_call":
      return Wrench;
    case "postprocess":
      return Sparkles;
    case "guardrail":
      return ShieldAlert;
    default:
      return TimerReset;
  }
}

interface TraceGraphViewProps {
  graph: TraceGraphRead;
  analysis: TraceGraphAnalysisRead | null;
  screenshotMode?: boolean;
}

export function TraceGraphView({ graph, analysis, screenshotMode = false }: TraceGraphViewProps) {
  const parentByChild = new Map(graph.edges.map((edge) => [edge.child_span_id, edge.parent_span_id]));
  const orderedNodes = [...graph.nodes].sort((left, right) => {
    const leftDepth = spanDepth(left.span_id, parentByChild);
    const rightDepth = spanDepth(right.span_id, parentByChild);
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });

  const legend = [
    "retrieval",
    "prompt_build",
    "llm_call",
    "tool_call",
    "postprocess",
    "guardrail",
  ] as const;

  return (
    <div
      className={cn("space-y-6", screenshotMode && "mx-auto w-[1600px] max-w-[1600px] space-y-5 overflow-hidden bg-white p-8")}
      data-trace-graph
      data-trace-graph-ready={screenshotMode ? "" : undefined}
    >
      <header className="rounded-[30px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        {!screenshotMode ? (
          <Link href={`/traces/${graph.trace_id}`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to trace
          </Link>
        ) : (
          <p className="text-xs uppercase tracking-[0.28em] text-steel">Reliai trace debugger</p>
        )}
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Execution graph</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{graph.trace_id}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
              AI system debugging view for one request across retrieval, prompt construction, model execution, tool calls, guardrails, and post-processing.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Spans</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{graph.nodes.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Edges</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{graph.edges.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Environment</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{graph.environment}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace analysis</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">What stands out in this request</h2>
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
                {analysis?.largest_token_span?.token_count !== null &&
                analysis?.largest_token_span?.token_count !== undefined
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
                  : "No concentrated retries"}
              </p>
            </div>
            <div className="rounded-[24px] border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Estimated cost surface</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {orderedNodes.reduce((sum, node) => sum + (node.prompt_tokens ?? 0) + (node.completion_tokens ?? 0), 0)} tokens
              </p>
              <p className="mt-1 text-sm text-steel">Across all recorded spans in this trace graph</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Span legend</p>
          <div className="mt-4 space-y-3">
            {legend.map((item) => {
              const Icon = spanIcon(item);
              return (
                <div key={item} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${spanTone(item)}`}>
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{spanLabel(item)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <Card className="rounded-[28px] border-zinc-300 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Execution breakdown</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Span tree</h2>
        <div className="mt-6 space-y-3">
          {orderedNodes.map((node) => {
            const depth = spanDepth(node.span_id, parentByChild);
            const type = normalizeSpanType(node.span_type, node.span_name);
            const Icon = spanIcon(type);
            const isSlowest = analysis?.slowest_span?.span_id === node.span_id;
            const isLargestToken = analysis?.largest_token_span?.span_id === node.span_id;
            const isRetrySpan = analysis?.most_guardrail_retries?.span_id === node.span_id;
            const tokenCount = (node.prompt_tokens ?? 0) + (node.completion_tokens ?? 0);

            return (
              <div
                key={node.id}
                className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 shadow-sm"
                style={{ marginLeft: `${depth * 26}px` }}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-steel">
                      {node.span_name ?? "request"} {screenshotMode ? "" : `· ${new Date(node.timestamp).toLocaleString()}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${spanTone(type)}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {spanLabel(type)}
                      </span>
                      <p className="text-lg font-semibold text-ink">{node.model_name}</p>
                    </div>
                    <p className="mt-1 text-sm text-steel">
                      span {node.span_id}
                      {node.parent_span_id ? ` · parent ${node.parent_span_id}` : " · root span"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-full px-3 py-1 font-medium ${node.success ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>
                      {node.success ? "Success" : "Failure"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
                      {node.latency_ms === null ? "n/a" : `${node.latency_ms} ms`}
                    </span>
                    {tokenCount > 0 ? (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
                        {tokenCount} tokens
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {node.guardrail_policy ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {node.guardrail_policy} · {node.guardrail_action ?? "action n/a"}
                    </span>
                  ) : null}
                  {isSlowest ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
                      <TimerReset className="h-3.5 w-3.5" />
                      Slowest span
                    </span>
                  ) : null}
                  {isLargestToken ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-3 py-1 text-xs font-medium text-white">
                      <Braces className="h-3.5 w-3.5" />
                      Largest token span
                    </span>
                  ) : null}
                  {isRetrySpan ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-rose-900 px-3 py-1 text-xs font-medium text-white">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Guardrail retry span
                    </span>
                  ) : null}
                </div>

                {!screenshotMode ? (
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-50 p-3 text-xs leading-5 text-ink">
                    {JSON.stringify(node.metadata_json ?? {}, null, 2)}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
