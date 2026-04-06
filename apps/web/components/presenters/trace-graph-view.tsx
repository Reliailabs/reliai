"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RecommendationCallout } from "@/components/ui/recommendation-callout";
import { cn, truncateMiddle } from "@/lib/utils";
import { buildRootCause, extractSignals } from "@/lib/root-cause-engine";
import { buildConfigPatch, buildSuggestedFix } from "@/lib/suggested-fix-engine";

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
      return "border-l-2 border-sky-400 text-primary";
    case "prompt_build":
      return "border-l-2 border-indigo-400 text-primary";
    case "llm_call":
      return "border-l-2 border-emerald-400 text-primary";
    case "tool_call":
      return "border-l-2 border-orange-400 text-primary";
    case "postprocess":
      return "border-l-2 border-amber-400 text-primary";
    case "guardrail":
      return "border-l-2 border-rose-400 text-primary";
    default:
      return "border-l-2 border-line text-primary";
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
  screenshotWidth?: number;
}

export function TraceGraphView({ graph, analysis, screenshotMode = false, screenshotWidth }: TraceGraphViewProps) {
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const parentByChild = new Map(graph.edges.map((edge) => [edge.child_span_id, edge.parent_span_id]));
  const orderedNodes = [...graph.nodes].sort((left, right) => {
    const leftDepth = spanDepth(left.span_id, parentByChild);
    const rightDepth = spanDepth(right.span_id, parentByChild);
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });

  const maxDuration = useMemo(() => {
    const max = orderedNodes.reduce((value, node) => {
      const duration = node.latency_ms ?? 0;
      return duration > value ? duration : value;
    }, 0);
    return max > 0 ? max : 1;
  }, [orderedNodes]);

  const shouldExpand = (node: (typeof orderedNodes)[number]) => {
    const spanAttributes =
      (node.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
        ?.attributes ?? {};
    const retryAttempt = spanAttributes.retry_attempt;
    const type = normalizeSpanType(node.span_type, node.span_name);
    return type === "retrieval" || type === "guardrail" || node.success === false || Boolean(retryAttempt);
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    if (screenshotMode) {
      return orderedNodes.reduce<Record<string, boolean>>((acc, node) => {
        acc[node.span_id] = true;
        return acc;
      }, {});
    }
    const nodeById = new Map(orderedNodes.map((node) => [node.span_id, node]));
    const next: Record<string, boolean> = {};
    const mark = (node: (typeof orderedNodes)[number]) => {
      next[node.span_id] = true;
      if (node.parent_span_id) {
        const parent = nodeById.get(node.parent_span_id);
        if (parent && !next[parent.span_id]) {
          mark(parent);
        }
      }
    };
    orderedNodes.forEach((node) => {
      if (shouldExpand(node)) {
        mark(node);
      }
    });
    return next;
  });

  const setExpandedAll = (value: boolean) => {
    setExpanded(
      orderedNodes.reduce<Record<string, boolean>>((acc, node) => {
        acc[node.span_id] = value;
        return acc;
      }, {})
    );
  };

  const rootCauseSummary = useMemo(() => {
    if (screenshotMode) return null;
    return buildRootCause(extractSignals(orderedNodes));
  }, [orderedNodes, screenshotMode]);

  const suggestedFix = useMemo(() => {
    if (screenshotMode) return null;
    return buildSuggestedFix(orderedNodes, rootCauseSummary);
  }, [orderedNodes, rootCauseSummary, screenshotMode]);

  const configPatch = useMemo(() => {
    if (!suggestedFix) return [];
    return buildConfigPatch(suggestedFix.pr_changes);
  }, [suggestedFix]);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyStatus, setApplyStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [undoStatus, setUndoStatus] = useState<"idle" | "pending" | "error">("idle");
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIncidentId(params.get("incident_id"));
  }, []);

  const canApplyFix = configPatch.length > 0 && !screenshotMode;

  const applyFix = async () => {
    if (!canApplyFix || applyStatus === "pending") return;
    setApplyStatus("pending");
    setApplyError(null);
    try {
      const response = await fetch("/api/config/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: configPatch,
          source_trace_id: graph.trace_id,
          incident_id: incidentId ?? undefined,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setApplyStatus("error");
        setApplyError(json?.detail ?? json?.error ?? "Failed to apply fix.");
        return;
      }
      setApplyStatus("success");
      setApplyOpen(false);
      setAppliedSummary("Fix applied. Config snapshot created.");
    } catch (error) {
      setApplyStatus("error");
      setApplyError(error instanceof Error ? error.message : "Failed to apply fix.");
    }
  };

  const undoFix = async () => {
    if (undoStatus === "pending") return;
    setUndoStatus("pending");
    setApplyError(null);
    try {
      const response = await fetch("/api/config/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_trace_id: graph.trace_id,
          incident_id: incidentId ?? undefined,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUndoStatus("error");
        setApplyError(json?.detail ?? json?.error ?? "Failed to undo fix.");
        return;
      }
      setUndoStatus("idle");
      setApplyStatus("idle");
      setAppliedSummary("Undo complete. Config reverted.");
    } catch (error) {
      setUndoStatus("error");
      setApplyError(error instanceof Error ? error.message : "Failed to undo fix.");
    }
  };

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
      className={cn(
        "space-y-6",
        screenshotMode &&
          cn("mx-auto space-y-5 overflow-hidden bg-white p-8", screenshotWidth && "w-[1600px] max-w-[1600px]")
      )}
      data-trace-graph
      data-trace-graph-ready={screenshotMode ? "" : undefined}
    >
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          {!screenshotMode ? (
            <Link
              href={`/traces/${graph.trace_id}`}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-secondary hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to trace
            </Link>
          ) : (
            <p className="text-xs uppercase tracking-[0.28em] text-secondary">Reliai trace debugger</p>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Execution graph</p>
            <h1 className="mt-2 text-lg font-semibold text-primary text-mono-data">
              {truncateMiddle(graph.trace_id)}
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Span relationships, retry chains, and failure points in one view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Spans</p>
              <p className="mt-1 text-sm font-semibold text-primary">{graph.nodes.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Edges</p>
              <p className="mt-1 text-sm font-semibold text-primary">{graph.edges.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Environment</p>
              <p className="mt-1 text-sm font-semibold text-primary">{graph.environment}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="rounded-2xl border-line bg-surface p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Execution breakdown</p>
            <h2 className="mt-2 text-xl font-semibold text-primary">Span tree</h2>
            {rootCauseSummary ? (
              <div className="mt-3 rounded-lg border border-error/30 bg-errorBg px-3 py-2 text-sm text-error">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-error">Root cause</p>
                <p className="mt-2 font-semibold text-primary">{rootCauseSummary.title}</p>
                <p className="mt-1 text-sm text-primary">{rootCauseSummary.summary}</p>
                {rootCauseSummary.evidence.length > 0 ? (
                  <ul className="mt-2 text-xs text-error">
                    {rootCauseSummary.evidence.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {suggestedFix ? (
              <div className="mt-3 space-y-3">
                <RecommendationCallout
                  label="Recommendation"
                  recommendation={suggestedFix.title}
                  supporting={
                    suggestedFix.actions.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {suggestedFix.actions.map((action) => (
                          <li key={action}>• {action}</li>
                        ))}
                      </ul>
                    ) : null
                  }
                />
                <div className="rounded-lg border border-line bg-surfaceAlt px-3 py-2 text-xs text-textPrimary">
                  {suggestedFix.pr_changes.map((change) => (
                    <div key={change}>{change}</div>
                  ))}
                </div>
                {!screenshotMode ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => setApplyOpen(true)} disabled={!canApplyFix}>
                      Apply fix
                    </Button>
                    {applyStatus === "success" ? (
                      <Button size="sm" variant="outline" onClick={undoFix} disabled={undoStatus === "pending"}>
                        Undo
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {appliedSummary ? <p className="text-xs text-success">{appliedSummary}</p> : null}
                {applyError ? <p className="text-xs text-error">{applyError}</p> : null}
              </div>
            ) : null}
            {!screenshotMode ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setExpandedAll(true)}>
                  Show all
                </Button>
                <Button size="sm" variant="outline" onClick={() => setExpandedAll(false)}>
                  Focus on issues
                </Button>
              </div>
            ) : null}
            <div className="mt-6 space-y-3">
              {orderedNodes.map((node) => {
                const depth = spanDepth(node.span_id, parentByChild);
                const type = normalizeSpanType(node.span_type, node.span_name);
                const Icon = spanIcon(type);
                const isSlowest = analysis?.slowest_span?.span_id === node.span_id;
                const isLargestToken = analysis?.largest_token_span?.span_id === node.span_id;
                const isRetrySpan = analysis?.most_guardrail_retries?.span_id === node.span_id;
                const tokenCount = (node.prompt_tokens ?? 0) + (node.completion_tokens ?? 0);
                const isExpanded = expanded[node.span_id] ?? true;
                const attrs =
                  (node.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
                    ?.attributes ?? {};
                const failureReason =
                  typeof attrs.failure_reason === "string" ? attrs.failure_reason : null;
                const explanation = typeof attrs.explanation === "string" ? attrs.explanation : null;
                const documentsFound =
                  typeof attrs.documents_found === "number" ? attrs.documents_found : Number(attrs.documents_found);
                const retryAttempt =
                  typeof attrs.retry_attempt === "number" ? attrs.retry_attempt : Number(attrs.retry_attempt);
                const showRetrievalFailure = !node.success && Boolean(failureReason);
                const recoveredAfterRetry = node.success && Boolean(retryAttempt) && retryAttempt > 1;
                const retryAttemptLabel =
                  typeof retryAttempt === "number"
                    ? `${retryAttempt} attempt${retryAttempt === 1 ? "" : "s"}`
                    : null;
                const duration = node.latency_ms ?? 0;
                const widthPercent = Math.max(
                  6,
                  node.parent_span_id === null ? 100 : Math.round((duration / maxDuration) * 100)
                );

                return (
                  <div
                    key={node.id}
                    className="rounded-xl border border-line bg-surfaceAlt px-4 py-4"
                    style={{ marginLeft: `${depth * 22}px` }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-secondary">
                          {node.span_name ?? "request"} {screenshotMode ? "" : `· ${new Date(node.timestamp).toLocaleString()}`}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] bg-surface ${spanTone(type)}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {spanLabel(type)}
                          </span>
                          <p className="text-base font-semibold text-primary">{node.model_name}</p>
                        </div>
                        <p className="mt-1 text-sm text-secondary">
                          <span className="text-mono-data">
                            span {truncateMiddle(node.span_id)}
                            {node.parent_span_id ? ` · parent ${truncateMiddle(node.parent_span_id)}` : " · root span"}
                          </span>
                        </p>
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center justify-between text-xs text-secondary">
                            <span className="font-medium text-primary">{node.span_name ?? "request"}</span>
                            <span>{duration} ms</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-bg">
                            <div
                              className={cn("h-2 rounded-full", node.success ? "bg-success" : "bg-error")}
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                        <span className={`rounded-full px-3 py-1 font-medium ${node.success ? "bg-successBg text-success ring-1 ring-success/30" : "bg-errorBg text-error ring-1 ring-error/30"}`}>
                          {node.success ? "Success" : "Failure"}
                        </span>
                        <span className="rounded-full bg-surface px-3 py-1 font-medium text-secondary ring-1 ring-line">
                          {node.latency_ms === null ? "—" : `${node.latency_ms} ms`}
                        </span>
                        {tokenCount > 0 ? (
                          <span className="rounded-full bg-surface px-3 py-1 font-medium text-secondary ring-1 ring-line">
                            {tokenCount} tokens
                          </span>
                        ) : null}
                        {!screenshotMode ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [node.span_id]: !isExpanded,
                              }))
                            }
                          >
                            {isExpanded ? "Collapse" : "Expand"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {!screenshotMode && isExpanded ? (
                      <>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {node.guardrail_policy ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-warningBg px-3 py-1 text-xs font-medium text-warning ring-1 ring-warning/30">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              {node.guardrail_policy} · {node.guardrail_action ?? "action —"}
                            </span>
                          ) : null}
                          {isSlowest ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-bg px-3 py-1 text-xs font-medium text-textPrimary ring-1 ring-line">
                              <TimerReset className="h-3.5 w-3.5" />
                              Slowest span
                            </span>
                          ) : null}
                          {isLargestToken ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-bg px-3 py-1 text-xs font-medium text-textPrimary ring-1 ring-line">
                              <Braces className="h-3.5 w-3.5" />
                              Largest token span
                            </span>
                          ) : null}
                          {isRetrySpan ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-bg px-3 py-1 text-xs font-medium text-textPrimary ring-1 ring-line">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Guardrail retry span
                            </span>
                          ) : null}
                        </div>
                        {showRetrievalFailure ? (
                          <div className="mt-4 rounded-lg border border-error/30 bg-errorBg p-3">
                            <div className="failure text-xs font-semibold text-error">
                              Retrieval failed: {failureReason ?? "unknown"}
                            </div>
                            {explanation ? <div className="mt-1 text-sm text-primary">{explanation}</div> : null}
                            <div className="mt-1 text-xs text-secondary">
                              {failureReason ? `reason: ${failureReason}` : "reason: —"}
                              {typeof documentsFound === "number" ? ` · docs: ${documentsFound}` : ""}
                              {typeof retryAttempt === "number" ? ` · attempt: ${retryAttempt}` : ""}
                            </div>
                          </div>
                        ) : null}
                        {recoveredAfterRetry ? (
                          <div className="mt-3 rounded-lg border border-success/30 bg-successBg p-3">
                            <div className="text-xs font-semibold text-success">
                              {retryAttemptLabel
                                ? `Recovered after retry (${retryAttemptLabel})`
                                : "Recovered after retry"}
                            </div>
                            <div className="mt-1 text-sm text-primary">
                              This retrieval recovered on attempt {retryAttempt}.
                            </div>
                          </div>
                        ) : null}
                        <pre className="mt-4 overflow-x-auto rounded-xl bg-bg p-3 text-xs leading-5 text-textPrimary">
                          {JSON.stringify(node.metadata_json ?? {}, null, 2)}
                        </pre>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <aside className="space-y-6">
          <div className={cn("rounded-2xl border border-line px-4 py-4", screenshotMode && screenshotWidth ? "bg-gray-50" : "bg-surface")}>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Key signals</p>
            <div className="mt-4 space-y-3">
              <div className={cn("rounded-lg border border-line px-3 py-2 text-sm text-secondary", screenshotMode && screenshotWidth ? "bg-gray-100" : "bg-surfaceAlt")}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Slowest span</p>
                <p className="mt-1 text-sm text-primary">{analysis?.slowest_span?.span_name ?? "—"}</p>
              </div>
              <div className={cn("rounded-lg border border-line px-3 py-2 text-sm text-secondary", screenshotMode && screenshotWidth ? "bg-gray-100" : "bg-surfaceAlt")}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Token spike</p>
                <p className="mt-1 text-sm text-primary">{analysis?.largest_token_span?.span_name ?? "—"}</p>
              </div>
              <div className={cn("rounded-lg border border-line px-3 py-2 text-sm text-secondary", screenshotMode && screenshotWidth ? "bg-gray-100" : "bg-surfaceAlt")}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Guardrail retries</p>
                <p className="mt-1 text-sm text-primary">
                  {analysis?.most_guardrail_retries?.guardrail_policy ?? "—"}
                </p>
              </div>
            </div>
          </div>
          <div className={cn("rounded-2xl border border-line px-4 py-4", screenshotMode && screenshotWidth ? "bg-gray-50" : "bg-surface")}>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Span legend</p>
            <div className="mt-4 space-y-3">
              {legend.map((item) => {
                const Icon = spanIcon(item);
                return (
                  <div
                    key={item}
                    className={cn(`flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm ${spanTone(item)}`, screenshotMode && screenshotWidth ? "bg-gray-100" : "bg-surfaceAlt")}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{spanLabel(item)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>

      {applyOpen && !screenshotMode ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-secondary">Confirm apply</p>
            <h3 className="mt-2 text-lg font-semibold text-primary">Apply suggested fix</h3>
            <p className="mt-2 text-sm text-secondary">
              This will update organization configuration based on the suggested fix.
            </p>
            <div className="mt-4 rounded-md bg-bg px-3 py-2 text-xs text-textPrimary">
              {configPatch.map((item) => (
                <div key={item.key}>
                  {item.key}: {String(item.from)} → {String(item.to)}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={applyFix} disabled={applyStatus === "pending" || !canApplyFix}>
                {applyStatus === "pending" ? "Applying..." : "Confirm apply"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setApplyOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
