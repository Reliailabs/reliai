"use client"

import type { TraceSummaryRead, TraceComparisonRead, TraceReplayRead } from "@reliai/types"


interface TraceAnalysisPanelProps {
  summary: TraceSummaryRead | null
  compare: TraceComparisonRead | null
  replay: TraceReplayRead | null
}

export function TraceAnalysisPanel({ summary, compare, replay }: TraceAnalysisPanelProps) {
  const hasSummary = summary !== null
  const hasCompare = compare !== null
  const hasReplay = replay !== null

  return (
    <div className="p-6 space-y-6">
      {/* Summary section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">Trace Summary</h3>
        {hasSummary ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Service</p>
              <p className="mt-1 text-sm text-zinc-300">{summary.service_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Model</p>
              <p className="mt-1 text-sm text-zinc-300">{summary.model_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Latency</p>
              <p className="mt-1 text-sm text-zinc-300">{summary.latency_ms !== null ? `${summary.latency_ms} ms` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Guardrail retries</p>
              <p className="mt-1 text-sm text-zinc-300">{summary.guardrail_retries}</p>
            </div>
            {summary.error_summary && (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Error summary</p>
                <p className="mt-1 text-sm text-zinc-300">{summary.error_summary}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No summary available for this trace.</p>
        )}
      </div>

      {/* Compare section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">Compare with Baseline</h3>
        {hasCompare ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Current traces</p>
                <p className="mt-1 text-sm text-zinc-300">{compare.current_traces.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Baseline traces</p>
                <p className="mt-1 text-sm text-zinc-300">{compare.baseline_traces.length}</p>
              </div>
            </div>
            {compare.pairs.length > 0 && (
              <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Comparison pairs</p>
                <ul className="mt-2 space-y-2">
                  {compare.pairs.slice(0, 3).map((pair, idx) => (
                    <li key={idx} className="text-xs text-zinc-400">
                      {pair.current_trace?.request_id ?? "Current"} vs {pair.baseline_trace?.request_id ?? "Baseline"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No comparison data available for this trace.</p>
        )}
      </div>

      {/* Replay section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">Replay Steps</h3>
        {hasReplay ? (
          <div className="space-y-3">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Total steps</p>
              <p className="mt-1 text-sm text-zinc-300">{replay.steps.length}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Replay snippet</p>
              <pre className="mt-2 text-xs font-mono text-zinc-400 overflow-x-auto p-2 bg-black/30 rounded">
                {`from reliai import replay\n\npipeline = replay("${replay.trace_id}")\nresult = pipeline.run()`}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No replay data available for this trace.</p>
        )}
      </div>
    </div>
  )
}