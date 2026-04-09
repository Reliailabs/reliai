"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, CheckCircle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { regressions } from "@/lib/mock-data"
import type { RegressionSnapshot, Severity } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// ── Severity → colors ─────────────────────────────────────────────────────────

const severityBorderColor: Record<Severity | "resolved", string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#3b82f6",
  resolved: "#10b981",
}

const severitySparkColor: Record<Severity | "resolved", string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#3b82f6",
  resolved: "#10b981",
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function MiniSparkline({ data, color }: { data: { value: number }[]; color: string }) {
  if (data.length < 2) return null
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 80
  const h = 32
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Regression row ────────────────────────────────────────────────────────────

function RegressionRow({
  reg,
  expanded,
  onToggle,
}: {
  reg: RegressionSnapshot
  expanded: boolean
  onToggle: () => void
}) {
  const isResolved = reg.status === "resolved"
  const sevKey: Severity | "resolved" = isResolved ? "resolved" : reg.severity
  const borderColor = severityBorderColor[sevKey]
  const sparkColor  = severitySparkColor[sevKey]

  return (
    <>
      {/* Main row */}
      <div
        onClick={onToggle}
        className={cn(
          "group flex items-center gap-0 border-b border-zinc-800/40 transition-colors cursor-pointer",
          expanded ? "bg-zinc-900/80" : "hover:bg-zinc-900/50",
          isResolved && "opacity-60"
        )}
      >
        {/* Severity left border */}
        <div
          className="w-[3px] self-stretch shrink-0"
          style={{ backgroundColor: borderColor }}
        />

        {/* Expand chevron */}
        <div className="w-8 shrink-0 flex items-center justify-center py-3.5">
          {isResolved ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500/70" />
          ) : expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
          )}
        </div>

        {/* Snapshot name + project */}
        <div className="w-52 shrink-0 py-3.5 pr-2 min-w-0">
          <div className="text-sm font-medium text-zinc-100 truncate leading-snug">
            {reg.name}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 truncate">{reg.project}</div>
        </div>

        {/* Metric */}
        <div className="w-36 shrink-0 py-3.5 hidden md:block">
          <span className="font-mono text-xs text-zinc-400">{reg.metric}</span>
        </div>

        {/* Baseline */}
        <div className="w-24 shrink-0 py-3.5 text-right hidden sm:block">
          <span className="text-xs text-zinc-500 tabular-nums">{reg.baselineValue}</span>
        </div>

        {/* Current */}
        <div className="w-24 shrink-0 py-3.5 text-right">
          <span
            className={cn(
              "text-sm tabular-nums font-medium",
              !isResolved && reg.deltaPercent > 0 ? "text-red-400" : "text-zinc-400"
            )}
          >
            {reg.currentValue}
          </span>
        </div>

        {/* Delta */}
        <div className="w-20 shrink-0 py-3.5 text-right">
          <span
            className={cn(
              "text-xs tabular-nums font-medium",
              !isResolved && reg.deltaPercent > 0 ? "text-red-400" : "text-emerald-400"
            )}
          >
            {reg.deltaPercent > 0 ? "+" : ""}{reg.deltaPercent}%
          </span>
        </div>

        {/* Trend sparkline */}
        <div className="w-24 shrink-0 py-3.5 flex items-center justify-center hidden lg:flex">
          <MiniSparkline data={reg.sparkline} color={sparkColor} />
        </div>

        {/* Detected + severity badge */}
        <div className="flex-1 min-w-0 py-3.5 pr-4 flex items-center justify-end gap-3">
          <span className="text-xs text-zinc-600 tabular-nums shrink-0 hidden xl:block">
            {reg.detectedAt}
          </span>
          <SeverityBadge severity={sevKey} />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-b border-zinc-800/40 bg-zinc-900/60 pl-11 pr-6 py-4">
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
            Snapshot diff
          </div>

          {/* Before / after comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4 max-w-sm">
            {/* Baseline */}
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">
                Baseline ({reg.baselineVersion})
              </div>
              <div className="text-2xl font-mono font-semibold text-zinc-400 tabular-nums leading-none tracking-tight">
                {reg.baselineValue}
              </div>
              <div className="text-[10px] text-zinc-600 mt-1 font-mono">{reg.metric}</div>
            </div>

            {/* Current */}
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">
                Current ({reg.promptVersion})
              </div>
              <div
                className={cn(
                  "text-2xl font-mono font-semibold tabular-nums leading-none tracking-tight",
                  !isResolved && reg.deltaPercent > 0 ? "text-red-400" : "text-zinc-400"
                )}
              >
                {reg.currentValue}
              </div>
              <div className="text-[10px] text-zinc-600 mt-1 font-mono">{reg.metric}</div>
              <div
                className={cn(
                  "inline-flex mt-2 text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums",
                  !isResolved && reg.deltaPercent > 0
                    ? "bg-red-500/10 text-red-400"
                    : "bg-emerald-500/10 text-emerald-400"
                )}
              >
                {reg.deltaPercent > 0 ? "+" : ""}{reg.deltaPercent}%
              </div>
            </div>
          </div>

          {/* Metadata pills */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-[10px] text-zinc-400">
              <span className="text-zinc-600 mr-1">Detected</span>{reg.detectedAt}
            </span>
            <span className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-[10px] text-zinc-400 font-mono">
              <span className="text-zinc-600 mr-1 font-sans">Prompt</span>
              {reg.baselineVersion} → {reg.promptVersion}
            </span>
            <span className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-[10px] text-zinc-400">
              <span className="text-zinc-600 mr-1">Model</span>{reg.model}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegressionsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const active   = regressions.filter((r) => r.status === "active")
  const resolved = regressions.filter((r) => r.status === "resolved")
  const visible  = showResolved ? regressions : active

  return (
    <div className="min-h-full">
      {/* Header */}
      <PageHeader
        title="Regressions"
        description="Snapshot diffs across prompt and model versions."
        right={
          <>
            <span className="text-xs tabular-nums">
              <span className="text-red-400 font-medium">{active.length}</span>
              <span className="text-zinc-500 ml-1">active</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs tabular-nums">
              <span className="text-zinc-400 font-medium">{resolved.length}</span>
              <span className="text-zinc-500 ml-1">resolved</span>
            </span>
          </>
        }
      />

      {/* Filter toggle */}
      <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-2">
        <button
          onClick={() => setShowResolved((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
            showResolved
              ? "bg-zinc-800 border-zinc-700 text-zinc-200"
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              showResolved ? "bg-emerald-500" : "bg-zinc-600"
            )}
          />
          {showResolved ? "Showing resolved" : "Active only"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {/* Sticky header */}
        <div className="flex items-center gap-0 pl-[3px] pr-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm text-[10px] font-semibold text-zinc-600 uppercase tracking-wider min-w-[720px]">
          {/* left border spacer */}
          <div className="w-8 shrink-0" />
          <div className="w-52 shrink-0">Snapshot</div>
          <div className="w-36 shrink-0 hidden md:block">Metric</div>
          <div className="w-24 shrink-0 text-right hidden sm:block">Baseline</div>
          <div className="w-24 shrink-0 text-right">Current</div>
          <div className="w-20 shrink-0 text-right">Delta</div>
          <div className="w-24 shrink-0 text-center hidden lg:block">Trend</div>
          <div className="flex-1 text-right">Severity / Detected</div>
        </div>

        {/* Rows */}
        <div className="min-w-[720px]">
          {visible.map((reg) => (
            <RegressionRow
              key={reg.id}
              reg={reg}
              expanded={expandedId === reg.id}
              onToggle={() =>
                setExpandedId(expandedId === reg.id ? null : reg.id)
              }
            />
          ))}

          {visible.length === 0 && (
            <div className="px-6 py-12 text-center text-xs text-zinc-600">
              No regressions match current filter
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
