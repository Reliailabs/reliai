"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type TraceStatus = "success" | "failed" | "refusal"

type EvaluationRow = {
  id: string
  evalType: string
  score: string | null
  label: string | null
  explanation: string | null
  evaluatorModel: string | null
  evaluatorProvider: string | null
  evaluatorVersion: string | null
  rawResultJson: Record<string, unknown> | null
}

type CustomMetricRow = {
  name: string
  matched: boolean
  value: number | boolean | null
}

type RetrievalSpanData = {
  retrievalLatencyMs: number | null
  sourceCount: number | null
  topK: number | null
  queryText: string | null
  retrievedChunks: Array<Record<string, unknown>> | null
}

type TraceDetailData = {
  id: string
  requestId: string
  traceId: string
  spanId: string
  spanName: string | null
  status: TraceStatus
  environment: "production" | "staging"
  model: string
  modelProvider: string | null
  promptVersion: string | null
  promptVersionRecord: { id: string; version: string; label: string | null } | null
  modelVersionRecord: {
    provider: string | null
    modelName: string
    modelVersion: string | null
    label: string | null
  } | null
  projectId: string
  userId: string | null
  sessionId: string | null
  age: string
  latency: number | null
  promptTokens: number | null
  completionTokens: number | null
  totalCostUsd: string | null
  errorType: string | null
  guardrailPolicy: string | null
  guardrailAction: string | null
  inputText: string | null
  outputText: string | null
  payloadTruncated: boolean
  metadataJson: Record<string, unknown> | null
  retrievalSpan: RetrievalSpanData | null
  evaluations: EvaluationRow[]
  customMetrics: CustomMetricRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusDot: Record<TraceStatus, string> = {
  success: "bg-emerald-500",
  failed:  "bg-red-500",
  refusal: "bg-amber-500",
}

const statusText: Record<TraceStatus, string> = {
  success: "text-emerald-400",
  failed:  "text-red-400",
  refusal: "text-amber-400",
}

const statusLabel: Record<TraceStatus, string> = {
  success: "Success",
  failed:  "Failed",
  refusal: "Refusal",
}

function RetrievedChunks({ chunks }: { chunks: Array<Record<string, unknown>> }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Retrieved Chunks ({chunks.length})
      </button>
      {open && (
        <pre className="mt-2 text-[11px] text-zinc-400 font-mono bg-zinc-950 rounded border border-zinc-800 p-3 overflow-x-auto max-h-64">
          {JSON.stringify(chunks, null, 2)}
        </pre>
      )}
    </div>
  )
}

function StatCell({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: "warn" | "critical" | "neutral"
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          mono && "font-mono",
          tone === "critical" && "text-red-400",
          tone === "warn" && "text-amber-400",
          !tone && "text-zinc-100"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
      {children}
    </div>
  )
}

function ContextRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zinc-800/50 last:border-0">
      <span className="text-[11px] text-zinc-600 shrink-0">{label}</span>
      <span className={cn("text-[11px] text-zinc-300 text-right break-all", mono && "font-mono")}>
        {value}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TraceDetailView({ trace }: { trace: TraceDetailData }) {
  const [metaExpanded, setMetaExpanded] = useState(false)

  const totalTokens =
    (trace.promptTokens ?? 0) + (trace.completionTokens ?? 0)

  const latencyTone =
    trace.latency !== null && trace.latency > 5
      ? "critical"
      : trace.latency !== null && trace.latency > 2
        ? "warn"
        : "neutral"

  return (
    <div className="min-h-full">
      <PageHeader
        title={trace.requestId}
        description={`${trace.model} · ${trace.environment === "staging" ? "staging" : "production"} · ${trace.age}`}
        right={
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full shrink-0", statusDot[trace.status])} />
            <span className={cn("text-xs font-medium", statusText[trace.status])}>
              {statusLabel[trace.status]}
            </span>
            {trace.environment === "staging" && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 border border-violet-500/30 rounded px-1.5 py-0.5">
                staging
              </span>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">

        {/* ── Back link ── */}
        <Link
          href="/traces"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All traces
        </Link>

        {/* ── Stat bar ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
          <StatCell
            label="Latency"
            value={trace.latency === null ? "—" : `${trace.latency.toFixed(2)}s`}
            mono
            tone={latencyTone === "neutral" ? undefined : latencyTone}
          />
          <StatCell
            label="Tokens"
            value={totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
            mono
          />
          <StatCell
            label="Prompt / Completion"
            value={
              trace.promptTokens !== null && trace.completionTokens !== null
                ? `${trace.promptTokens.toLocaleString()} / ${trace.completionTokens.toLocaleString()}`
                : "—"
            }
            mono
          />
          <StatCell
            label="Cost"
            value={trace.totalCostUsd !== null ? `$${trace.totalCostUsd}` : "—"}
            mono
          />
        </div>

        {/* ── Error callout ── */}
        {trace.status === "failed" && trace.errorType && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-red-400 mb-0.5">Error</div>
              <div className="text-xs text-zinc-400 font-mono">{trace.errorType}</div>
            </div>
          </div>
        )}

        {/* ── Guardrail callout ── */}
        {trace.guardrailPolicy && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-amber-400 mb-0.5">Guardrail triggered</div>
              <div className="text-xs text-zinc-400">
                <span className="font-mono text-zinc-300">{trace.guardrailPolicy}</span>
                {trace.guardrailAction && (
                  <span className="ml-2 text-zinc-500">→ {trace.guardrailAction}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Input / Output ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <SectionLabel>Input</SectionLabel>
              {trace.payloadTruncated && (
                <span className="text-[10px] text-amber-500 font-medium">truncated</span>
              )}
            </div>
            <pre className="px-4 py-3 text-xs text-zinc-400 font-mono whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
              {trace.inputText ?? <span className="text-zinc-600 italic">No input recorded</span>}
            </pre>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800">
              <SectionLabel>Output</SectionLabel>
            </div>
            <pre
              className={cn(
                "px-4 py-3 text-xs font-mono whitespace-pre-wrap break-words max-h-72 overflow-y-auto",
                trace.status === "failed" ? "text-red-400" : "text-zinc-300"
              )}
            >
              {trace.outputText ?? <span className="text-zinc-600 italic">No output recorded</span>}
            </pre>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Left column: Evaluations + Custom metrics + Retrieval ── */}
          <div className="xl:col-span-2 space-y-6">

            {/* Evaluations */}
            {trace.evaluations.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-zinc-800">
                  <SectionLabel>Evaluations</SectionLabel>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {trace.evaluations.map((ev) => {
                    const scoreNum = ev.score !== null ? parseFloat(ev.score) : null
                    const scoreTone =
                      scoreNum === null ? "neutral"
                      : scoreNum >= 0.8 ? "pass"
                      : scoreNum >= 0.5 ? "warn"
                      : "fail"
                    return (
                      <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-zinc-200 font-mono">
                              {ev.evalType}
                            </span>
                            {ev.label && (
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                  ev.label.toLowerCase() === "pass"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                                )}
                              >
                                {ev.label}
                              </span>
                            )}
                            {ev.evaluatorModel && (
                              <span className="text-[10px] text-zinc-600 font-mono">
                                {ev.evaluatorProvider
                                  ? `${ev.evaluatorProvider} / ${ev.evaluatorModel}`
                                  : ev.evaluatorModel}
                                {ev.evaluatorVersion && (
                                  <span className="text-zinc-700"> · {ev.evaluatorVersion}</span>
                                )}
                              </span>
                            )}
                          </div>
                          {ev.explanation && (
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                              {ev.explanation}
                            </p>
                          )}
                        </div>
                        {scoreNum !== null && (
                          <div
                            className={cn(
                              "text-sm font-mono font-semibold tabular-nums shrink-0",
                              scoreTone === "pass" && "text-emerald-400",
                              scoreTone === "warn" && "text-amber-400",
                              scoreTone === "fail" && "text-red-400",
                              scoreTone === "neutral" && "text-zinc-400",
                            )}
                          >
                            {scoreNum.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom metrics */}
            {trace.customMetrics.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-zinc-800">
                  <SectionLabel>Custom Metrics</SectionLabel>
                </div>
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {trace.customMetrics.map((m) => (
                    <span
                      key={m.name}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border",
                        m.matched
                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-500"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          m.matched ? "bg-emerald-500" : "bg-zinc-600"
                        )}
                      />
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Retrieval span */}
            {trace.retrievalSpan && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-zinc-800">
                  <SectionLabel>Retrieval</SectionLabel>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <StatCell
                      label="Latency"
                      value={
                        trace.retrievalSpan.retrievalLatencyMs !== null
                          ? `${trace.retrievalSpan.retrievalLatencyMs}ms`
                          : "—"
                      }
                      mono
                    />
                    <StatCell
                      label="Sources"
                      value={
                        trace.retrievalSpan.sourceCount !== null
                          ? String(trace.retrievalSpan.sourceCount)
                          : "—"
                      }
                      mono
                    />
                    <StatCell
                      label="Top K"
                      value={
                        trace.retrievalSpan.topK !== null
                          ? String(trace.retrievalSpan.topK)
                          : "—"
                      }
                      mono
                    />
                  </div>
                  {trace.retrievalSpan.queryText && (
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">
                        Query
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">
                        {trace.retrievalSpan.queryText}
                      </p>
                    </div>
                  )}
                  {trace.retrievalSpan.retrievedChunks &&
                    trace.retrievalSpan.retrievedChunks.length > 0 && (
                      <RetrievedChunks chunks={trace.retrievalSpan.retrievedChunks} />
                    )}
                </div>
              </div>
            )}

            {/* Metadata */}
            {trace.metadataJson && Object.keys(trace.metadataJson).length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setMetaExpanded(!metaExpanded)}
                  className="w-full px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between hover:bg-zinc-800/40 transition-colors"
                >
                  <SectionLabel>Metadata</SectionLabel>
                  {metaExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  }
                </button>
                {metaExpanded && (
                  <pre className="px-4 py-3 text-[11px] text-zinc-500 font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {JSON.stringify(trace.metadataJson, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* ── Right column: Context ── */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800">
                <SectionLabel>Context</SectionLabel>
              </div>
              <div className="px-4 py-2">
                <ContextRow label="Project" value={trace.projectId} mono />
                <ContextRow
                  label="Environment"
                  value={trace.environment}
                />
                <ContextRow label="Trace ID" value={trace.traceId} mono />
                <ContextRow label="Span ID" value={trace.spanId} mono />
                {trace.spanName && (
                  <ContextRow label="Span name" value={trace.spanName} mono />
                )}
                {trace.userId && (
                  <ContextRow label="User" value={trace.userId} mono />
                )}
                {trace.sessionId && (
                  <ContextRow label="Session" value={trace.sessionId} mono />
                )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800">
                <SectionLabel>Version</SectionLabel>
              </div>
              <div className="px-4 py-2">
                {trace.promptVersionRecord ? (
                  <ContextRow
                    label="Prompt"
                    value={
                      trace.promptVersionRecord.label ??
                      `v${trace.promptVersionRecord.version}`
                    }
                    mono
                  />
                ) : trace.promptVersion ? (
                  <ContextRow label="Prompt" value={trace.promptVersion} mono />
                ) : (
                  <ContextRow label="Prompt" value="—" />
                )}
                {trace.modelVersionRecord ? (
                  <>
                    <ContextRow
                      label="Model"
                      value={trace.modelVersionRecord.modelName}
                      mono
                    />
                    {trace.modelVersionRecord.modelVersion && (
                      <ContextRow
                        label="Version"
                        value={trace.modelVersionRecord.modelVersion}
                        mono
                      />
                    )}
                    {trace.modelVersionRecord.provider && (
                      <ContextRow
                        label="Provider"
                        value={trace.modelVersionRecord.provider}
                      />
                    )}
                  </>
                ) : (
                  <ContextRow label="Model" value={trace.model} mono />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
