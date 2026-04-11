"use client"

import { useMemo, useState } from "react"
import {
  Bot,
  Braces,
  Search,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Wrench,
} from "lucide-react"

import type { TraceGraphAnalysisRead, TraceGraphRead } from "@reliai/types"

import { RecommendationCallout } from "@/components/ui/recommendation-callout"
import { cn, truncateMiddle } from "@/lib/utils"
import { buildRootCause, extractSignals } from "@/lib/root-cause-engine"
import { buildConfigPatch, buildSuggestedFix } from "@/lib/suggested-fix-engine"

// ── Helpers ───────────────────────────────────────────────────────────────────

function spanDepth(spanId: string, parentByChild: Map<string, string | null>) {
  let depth = 0
  let current = parentByChild.get(spanId) ?? null
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    depth += 1
    current = parentByChild.get(current) ?? null
  }
  return depth
}

function normalizeSpanType(spanType: string | null | undefined, spanName: string | null | undefined) {
  const value = (spanType ?? spanName ?? "request").toLowerCase()
  if (value === "prompt_build") return "prompt_build"
  if (value === "llm_call") return "llm_call"
  if (value === "tool_call") return "tool_call"
  if (value === "postprocess") return "postprocess"
  if (value === "retrieval") return "retrieval"
  if (value === "guardrail") return "guardrail"
  return "request"
}

function spanLabel(spanType: string) {
  if (spanType === "prompt_build") return "prompt build"
  if (spanType === "llm_call") return "llm call"
  if (spanType === "tool_call") return "tool call"
  return spanType.replaceAll("_", " ")
}

function spanBorderClass(spanType: string) {
  switch (spanType) {
    case "retrieval":    return "border-l-2 border-sky-500"
    case "prompt_build": return "border-l-2 border-indigo-500"
    case "llm_call":    return "border-l-2 border-emerald-500"
    case "tool_call":   return "border-l-2 border-orange-500"
    case "postprocess": return "border-l-2 border-amber-500"
    case "guardrail":   return "border-l-2 border-rose-500"
    default:            return "border-l-2 border-zinc-600"
  }
}

function spanBadgeClass(spanType: string) {
  switch (spanType) {
    case "retrieval":    return "border-sky-500/30 text-sky-400"
    case "prompt_build": return "border-indigo-500/30 text-indigo-400"
    case "llm_call":    return "border-emerald-500/30 text-emerald-400"
    case "tool_call":   return "border-orange-500/30 text-orange-400"
    case "postprocess": return "border-amber-500/30 text-amber-400"
    case "guardrail":   return "border-rose-500/30 text-rose-400"
    default:            return "border-zinc-700 text-zinc-400"
  }
}

function spanIcon(spanType: string) {
  switch (spanType) {
    case "retrieval":    return Search
    case "prompt_build": return Braces
    case "llm_call":    return Bot
    case "tool_call":   return Wrench
    case "postprocess": return Sparkles
    case "guardrail":   return ShieldAlert
    default:            return TimerReset
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface TraceGraphViewProps {
  graph: TraceGraphRead
  analysis: TraceGraphAnalysisRead | null
}

export function TraceGraphView({ graph, analysis }: TraceGraphViewProps) {
  const parentByChild = new Map(graph.edges.map((edge) => [edge.child_span_id, edge.parent_span_id]))
  const orderedNodes = [...graph.nodes].sort((a, b) => {
    const aDepth = spanDepth(a.span_id, parentByChild)
    const bDepth = spanDepth(b.span_id, parentByChild)
    if (aDepth !== bDepth) return aDepth - bDepth
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  })

  const maxDuration = useMemo(() => {
    const max = orderedNodes.reduce((value, node) => {
      const duration = node.latency_ms ?? 0
      return duration > value ? duration : value
    }, 0)
    return max > 0 ? max : 1
  }, [orderedNodes])

  const shouldExpand = (node: (typeof orderedNodes)[number]) => {
    const spanAttributes =
      (node.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
        ?.attributes ?? {}
    const retryAttempt = spanAttributes.retry_attempt
    const type = normalizeSpanType(node.span_type, node.span_name)
    return type === "retrieval" || type === "guardrail" || node.success === false || Boolean(retryAttempt)
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const nodeById = new Map(orderedNodes.map((node) => [node.span_id, node]))
    const next: Record<string, boolean> = {}
    const mark = (node: (typeof orderedNodes)[number]) => {
      next[node.span_id] = true
      if (node.parent_span_id) {
        const parent = nodeById.get(node.parent_span_id)
        if (parent && !next[parent.span_id]) {
          mark(parent)
        }
      }
    }
    orderedNodes.forEach((node) => {
      if (shouldExpand(node)) {
        mark(node)
      }
    })
    return next
  })

  const setExpandedAll = (value: boolean) => {
    setExpanded(
      orderedNodes.reduce<Record<string, boolean>>((acc, node) => {
        acc[node.span_id] = value
        return acc
      }, {})
    )
  }

  const rootCauseSummary = useMemo(() => buildRootCause(extractSignals(orderedNodes)), [orderedNodes])
  const suggestedFix = useMemo(
    () => buildSuggestedFix(orderedNodes, rootCauseSummary),
    [orderedNodes, rootCauseSummary]
  )
  const configPatch = useMemo(() => {
    if (!suggestedFix) return []
    return buildConfigPatch(suggestedFix.pr_changes)
  }, [suggestedFix])

  const [applyOpen, setApplyOpen] = useState(false)
  const [applyStatus, setApplyStatus] = useState<"idle" | "pending" | "success" | "error">("idle")
  const [applyError, setApplyError] = useState<string | null>(null)
  const [undoStatus, setUndoStatus] = useState<"idle" | "pending" | "error">("idle")
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null)

  const canApplyFix = configPatch.length > 0

  const applyFix = async () => {
    if (!canApplyFix || applyStatus === "pending") return
    setApplyStatus("pending")
    setApplyError(null)
    try {
      const response = await fetch("/api/config/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: configPatch, source_trace_id: graph.trace_id }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setApplyStatus("error")
        setApplyError(json?.detail ?? json?.error ?? "Failed to apply fix.")
        return
      }
      setApplyStatus("success")
      setApplyOpen(false)
      setAppliedSummary("Fix applied. Config snapshot created.")
    } catch (error) {
      setApplyStatus("error")
      setApplyError(error instanceof Error ? error.message : "Failed to apply fix.")
    }
  }

  const undoFix = async () => {
    if (undoStatus === "pending") return
    setUndoStatus("pending")
    setApplyError(null)
    try {
      const response = await fetch("/api/config/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_trace_id: graph.trace_id }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setUndoStatus("error")
        setApplyError(json?.detail ?? json?.error ?? "Failed to undo fix.")
        return
      }
      setUndoStatus("idle")
      setApplyStatus("idle")
      setAppliedSummary("Undo complete. Config reverted.")
    } catch (error) {
      setUndoStatus("error")
      setApplyError(error instanceof Error ? error.message : "Failed to undo fix.")
    }
  }

  const legend = [
    "retrieval",
    "prompt_build",
    "llm_call",
    "tool_call",
    "postprocess",
    "guardrail",
  ] as const

  return (
    <div className="space-y-6">
      {/* ── Summary bar ── */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Spans</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">{graph.nodes.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Edges</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">{graph.edges.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Environment</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-100">{graph.environment}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Trace ID</p>
          <p className="mt-0.5 text-xs font-mono text-zinc-400">{truncateMiddle(graph.trace_id, 8, 8)}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setExpandedAll(true)}
            className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Expand all
          </button>
          <button
            onClick={() => setExpandedAll(false)}
            className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Focus issues
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* ── Span tree ── */}
        <div className="space-y-4">
          {/* Root cause callout */}
          {rootCauseSummary ? (
            <div className="rounded-lg border border-red-500/20 bg-red-950/30 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Root cause</p>
              <p className="mt-1.5 text-sm font-semibold text-zinc-100">{rootCauseSummary.title}</p>
              <p className="mt-1 text-xs text-zinc-400">{rootCauseSummary.summary}</p>
              {rootCauseSummary.evidence.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-red-400">
                  {rootCauseSummary.evidence.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/* Suggested fix */}
          {suggestedFix ? (
            <div className="space-y-2">
              <RecommendationCallout
                label="Recommendation"
                recommendation={suggestedFix.title}
                supporting={
                  suggestedFix.actions.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {suggestedFix.actions.map((action) => (
                        <li key={action}>• {action}</li>
                      ))}
                    </ul>
                  ) : null
                }
              />
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-400">
                {suggestedFix.pr_changes.map((change) => (
                  <div key={change}>{change}</div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setApplyOpen(true)}
                  disabled={!canApplyFix}
                  className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-40"
                >
                  Apply fix
                </button>
                {applyStatus === "success" && (
                  <button
                    onClick={undoFix}
                    disabled={undoStatus === "pending"}
                    className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
                  >
                    Undo
                  </button>
                )}
              </div>
              {appliedSummary && <p className="text-xs text-emerald-400">{appliedSummary}</p>}
              {applyError && <p className="text-xs text-red-400">{applyError}</p>}
            </div>
          ) : null}

          {/* Span rows */}
          <div className="space-y-2">
            {orderedNodes.map((node) => {
              const depth = spanDepth(node.span_id, parentByChild)
              const type = normalizeSpanType(node.span_type, node.span_name)
              const Icon = spanIcon(type)
              const isSlowest = analysis?.slowest_span?.span_id === node.span_id
              const isLargestToken = analysis?.largest_token_span?.span_id === node.span_id
              const isRetrySpan = analysis?.most_guardrail_retries?.span_id === node.span_id
              const tokenCount = (node.prompt_tokens ?? 0) + (node.completion_tokens ?? 0)
              const isExpanded = expanded[node.span_id] ?? true
              const attrs =
                (node.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
                  ?.attributes ?? {}
              const failureReason = typeof attrs.failure_reason === "string" ? attrs.failure_reason : null
              const explanation = typeof attrs.explanation === "string" ? attrs.explanation : null
              const documentsFound =
                typeof attrs.documents_found === "number"
                  ? attrs.documents_found
                  : Number(attrs.documents_found)
              const retryAttempt =
                typeof attrs.retry_attempt === "number"
                  ? attrs.retry_attempt
                  : Number(attrs.retry_attempt)
              const showRetrievalFailure = !node.success && Boolean(failureReason)
              const recoveredAfterRetry = node.success && Boolean(retryAttempt) && retryAttempt > 1
              const retryAttemptLabel =
                typeof retryAttempt === "number"
                  ? `${retryAttempt} attempt${retryAttempt === 1 ? "" : "s"}`
                  : null
              const duration = node.latency_ms ?? 0
              const widthPercent = Math.max(
                6,
                node.parent_span_id === null ? 100 : Math.round((duration / maxDuration) * 100)
              )

              return (
                <div
                  key={node.id}
                  className={cn(
                    "rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3",
                    spanBorderClass(type)
                  )}
                  style={{ marginLeft: `${depth * 20}px` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                        {node.span_name ?? "request"} · {new Date(node.timestamp).toLocaleTimeString()}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            spanBadgeClass(type)
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {spanLabel(type)}
                        </span>
                        {node.model_name && (
                          <span className="text-xs font-medium text-zinc-400 font-mono">
                            {node.model_name}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-zinc-700">
                        {truncateMiddle(node.span_id)}
                        {node.parent_span_id
                          ? ` · parent ${truncateMiddle(node.parent_span_id)}`
                          : " · root"}
                      </p>
                      {/* Duration bar */}
                      <div className="mt-2 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-zinc-600">
                          <span className="text-zinc-500">{node.span_name ?? "request"}</span>
                          <span>{duration} ms</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-zinc-800">
                          <div
                            className={cn(
                              "h-1 rounded-full",
                              node.success ? "bg-emerald-500" : "bg-red-500"
                            )}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-semibold",
                          node.success
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        )}
                      >
                        {node.success ? "ok" : "fail"}
                      </span>
                      {node.latency_ms !== null && (
                        <span className="text-[10px] font-mono text-zinc-600">{node.latency_ms}ms</span>
                      )}
                      {tokenCount > 0 && (
                        <span className="text-[10px] font-mono text-zinc-600">{tokenCount}t</span>
                      )}
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [node.span_id]: !isExpanded,
                          }))
                        }
                        className="text-[10px] text-zinc-600 hover:text-zinc-400"
                      >
                        {isExpanded ? "collapse" : "expand"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {node.guardrail_policy && (
                          <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            <ShieldAlert className="h-3 w-3" />
                            {node.guardrail_policy} · {node.guardrail_action ?? "—"}
                          </span>
                        )}
                        {isSlowest && (
                          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            <TimerReset className="h-3 w-3" />
                            Slowest span
                          </span>
                        )}
                        {isLargestToken && (
                          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            <Braces className="h-3 w-3" />
                            Largest token span
                          </span>
                        )}
                        {isRetrySpan && (
                          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            <ShieldAlert className="h-3 w-3" />
                            Guardrail retry span
                          </span>
                        )}
                      </div>
                      {showRetrievalFailure && (
                        <div className="mt-3 rounded border border-red-500/20 bg-red-950/30 p-2.5">
                          <div className="text-[10px] font-semibold text-red-400">
                            Retrieval failed: {failureReason ?? "unknown"}
                          </div>
                          {explanation && <div className="mt-0.5 text-xs text-zinc-400">{explanation}</div>}
                          <div className="mt-0.5 text-[10px] text-zinc-600">
                            {failureReason ? `reason: ${failureReason}` : ""}
                            {typeof documentsFound === "number" ? ` · docs: ${documentsFound}` : ""}
                            {typeof retryAttempt === "number" ? ` · attempt: ${retryAttempt}` : ""}
                          </div>
                        </div>
                      )}
                      {recoveredAfterRetry && (
                        <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-950/30 p-2.5">
                          <div className="text-[10px] font-semibold text-emerald-400">
                            {retryAttemptLabel ? `Recovered after retry (${retryAttemptLabel})` : "Recovered after retry"}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-400">
                            This retrieval recovered on attempt {retryAttempt}.
                          </div>
                        </div>
                      )}
                      <pre className="mt-3 max-h-48 overflow-x-auto rounded bg-zinc-950 p-2.5 text-[10px] leading-relaxed text-zinc-500">
                        {JSON.stringify(node.metadata_json ?? {}, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          {/* Key signals */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Key signals</p>
            <div className="mt-3 space-y-2">
              <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Slowest span</p>
                <p className="mt-0.5 text-xs text-zinc-300">{analysis?.slowest_span?.span_name ?? "—"}</p>
                {analysis?.slowest_span && (
                  <p className="text-[10px] font-mono text-zinc-600">
                    {analysis.slowest_span.latency_ms}ms
                  </p>
                )}
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Token spike</p>
                <p className="mt-0.5 text-xs text-zinc-300">{analysis?.largest_token_span?.span_name ?? "—"}</p>
                {analysis?.largest_token_span && (
                  <p className="text-[10px] font-mono text-zinc-600">
                    {analysis.largest_token_span.token_count}t
                  </p>
                )}
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Guardrail retries</p>
                <p className="mt-0.5 text-xs text-zinc-300">
                  {analysis?.most_guardrail_retries?.guardrail_policy ?? "—"}
                </p>
                {analysis?.most_guardrail_retries && (
                  <p className="text-[10px] font-mono text-zinc-600">
                    {analysis.most_guardrail_retries.retry_count} retries
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Span types</p>
            <div className="mt-3 space-y-1.5">
              {legend.map((item) => {
                const Icon = spanIcon(item)
                return (
                  <div
                    key={item}
                    className={cn(
                      "flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs",
                      spanBorderClass(item)
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", spanBadgeClass(item).split(" ").pop())} />
                    <span className="font-medium text-zinc-400">{spanLabel(item)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Apply fix modal ── */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Confirm apply</p>
            <h3 className="mt-1.5 text-base font-semibold text-zinc-100">Apply suggested fix</h3>
            <p className="mt-1 text-xs text-zinc-500">
              This will update organization configuration based on the suggested fix.
            </p>
            <div className="mt-3 rounded bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-400">
              {configPatch.map((item) => (
                <div key={item.key}>
                  {item.key}: {String(item.from)} → {String(item.to)}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={applyFix}
                disabled={applyStatus === "pending" || !canApplyFix}
                className="rounded border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:border-zinc-500 disabled:opacity-40"
              >
                {applyStatus === "pending" ? "Applying…" : "Confirm apply"}
              </button>
              <button
                onClick={() => setApplyOpen(false)}
                className="rounded border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
