"use client"

import { useState } from "react"
import { Play, RotateCcw, Clock, Zap, Hash } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

interface ReplayTrace {
  id: string
  requestId: string
  input: string
  expectedOutput: string
  model: string
  project: string
  age: string
  regressionId: string
}

interface PromptVersion {
  id: string
  label: string
  version: string
  model: string
  promptText: string
}

interface ReplayResult {
  versionId: string
  output: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  score: number
  scoreLabel: string
  pass: boolean
}

function ScoreBadge({ score, pass }: { score: number; pass: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border",
      pass
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-red-500/10 border-red-500/20 text-red-400"
    )}>
      {pass ? "PASS" : "FAIL"} · {(score * 100).toFixed(0)}%
    </span>
  )
}

function MetricPill({ icon: Icon, value, label, highlight }: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
  highlight?: "warn" | "bad" | null
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 border rounded px-3 py-2 text-xs",
      highlight === "bad"
        ? "border-red-500/30 bg-red-500/10 text-red-400"
        : highlight === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-zinc-800 bg-zinc-900/40 text-zinc-400"
    )}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono tabular-nums text-zinc-200">{value}</span>
    </div>
  )
}

export function EvalReplayView({
  traces,
  promptVersions,
  results,
}: {
  traces: ReplayTrace[]
  promptVersions: PromptVersion[]
  results: Record<string, Record<string, ReplayResult>>
}) {
  const [selectedTraceId, setSelectedTraceId] = useState(traces[0]?.id)
  const [selectedVersionId, setSelectedVersionId] = useState(promptVersions[0]?.id)

  const trace = traces.find((t) => t.id === selectedTraceId) ?? traces[0]
  const selectedResults = trace ? results[trace.id] ?? {} : {}
  const selectedResult = selectedVersionId ? selectedResults[selectedVersionId] : undefined

  return (
    <div className="min-h-full">
      <PageHeader
        title="Evaluation Replay"
        description="Replay traces against prompt versions to diagnose regressions."
      />

      <div className="p-6 space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
              Trace
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-xs bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-300"
                value={selectedTraceId}
                onChange={(e) => setSelectedTraceId(e.target.value)}
              >
                {traces.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.requestId}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">{trace?.age}</span>
            </div>
          </div>

          {trace && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                  Input
                </div>
                <div className="text-xs text-zinc-300 whitespace-pre-wrap">
                  {trace.input}
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                  Expected Output
                </div>
                <div className="text-xs text-zinc-300 whitespace-pre-wrap">
                  {trace.expectedOutput}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Prompt Versions
              </div>
              <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Compare →
              </button>
            </div>
            <div className="space-y-3">
              {promptVersions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => setSelectedVersionId(version.id)}
                  className={cn(
                    "w-full text-left border rounded-lg px-4 py-3 transition-colors",
                    selectedVersionId === version.id
                      ? "border-zinc-600 bg-zinc-900/80"
                      : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">{version.label}</span>
                    <span className="text-[10px] text-zinc-500">{version.version}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{version.model}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Replay Output
              </div>
              {selectedResult && <ScoreBadge score={selectedResult.score} pass={selectedResult.pass} />}
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 whitespace-pre-wrap min-h-[180px]">
              {selectedResult?.output ?? "No replay output available."}
            </div>
            {selectedResult && (
              <div className="grid grid-cols-2 gap-2">
                <MetricPill
                  icon={Clock}
                  label="Latency"
                  value={`${selectedResult.latencyMs}ms`}
                  highlight={selectedResult.latencyMs > 700 ? "warn" : null}
                />
                <MetricPill
                  icon={Hash}
                  label="Tokens"
                  value={`${selectedResult.inputTokens + selectedResult.outputTokens}`}
                  highlight={selectedResult.outputTokens > 200 ? "warn" : null}
                />
                <MetricPill
                  icon={Zap}
                  label="Input"
                  value={`${selectedResult.inputTokens}`}
                />
                <MetricPill
                  icon={Zap}
                  label="Output"
                  value={`${selectedResult.outputTokens}`}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors">
                <Play className="w-3.5 h-3.5" />
                Replay
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
