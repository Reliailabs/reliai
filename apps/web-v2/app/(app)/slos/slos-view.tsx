"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

export type SLOEntry = {
  id: string
  name: string
  description: string
  current: number | null
  target: number
  unit: string
  status: "healthy" | "at_risk" | "breached" | null
  trend: "up" | "down" | "flat" | null
  projectId: string
  projectName: string
  windowDays: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const statusConfig = {
  healthy: {
    dot:    "bg-emerald-500",
    color:  "text-emerald-400",
    bg:     "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  at_risk: {
    dot:    "bg-amber-500",
    color:  "text-amber-400",
    bg:     "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  breached: {
    dot:    "bg-red-500",
    color:  "text-red-400",
    bg:     "bg-red-500/10",
    border: "border-red-500/20",
  },
  neutral: {
    dot: "bg-zinc-600",
    color: "text-zinc-400",
    bg: "bg-zinc-800/40",
    border: "border-zinc-700/60",
  },
}

const trendIcon  = { up: TrendingUp, down: TrendingDown, flat: Minus }
const trendColor = { up: "text-emerald-400", down: "text-red-400", flat: "text-zinc-500", neutral: "text-zinc-500" }

const periods = ["7d", "30d", "90d"] as const

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  slos: SLOEntry[]
  projects: { id: string; name: string }[]
  period?: string
}

export function SLOsView({ slos, projects, period = "30d" }: Props) {
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id ?? "",
  )

  const filtered = slos.filter((s) => s.projectId === selectedProjectId)

  const breached = filtered.filter((s) => s.status === "breached").length
  const atRisk   = filtered.filter((s) => s.status === "at_risk").length

  if (projects.length === 0) {
    return (
      <div className="min-h-full">
        <PageHeader
          title="SLOs"
          description="Track SLO compliance and trends for your AI projects"
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-sm text-zinc-500">No projects found</div>
          <div className="text-xs text-zinc-700 mt-1">
            Create a project to start tracking SLOs
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="SLOs"
        description="Track SLO compliance and trends for your AI projects"
        right={
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-zinc-200 font-medium">{filtered.length}</span>{" "}
              objectives
            </span>
            {breached > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-red-400 tabular-nums">
                  {breached} breached
                </span>
              </>
            )}
            {atRisk > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-amber-400 tabular-nums">
                  {atRisk} at risk
                </span>
              </>
            )}
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-zinc-800/60">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0">
          Project
        </span>
        <div className="flex gap-1 flex-wrap">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={cn(
                "px-2 py-0.5 text-xs rounded border transition-colors font-medium",
                selectedProjectId === p.id
                  ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                  : "bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="w-px h-3.5 bg-zinc-800 shrink-0" />

        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0">
          Period
        </span>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => router.push(`?period=${p}`)}
              className={cn(
                "px-2 py-0.5 text-xs rounded border transition-colors font-mono",
                period === p
                  ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                  : "bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm">
        <div className="w-5 shrink-0" />
        <div className="flex-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
          Objective
        </div>
        <div className="w-32 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">
          Current / Target
        </div>
        <div className="w-36 shrink-0" />
        <div className="w-16 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">
          Trend
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-800/40">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-sm text-zinc-500">
              No SLOs available for this project
            </div>
            <div className="text-xs text-zinc-700 mt-1">
              SLOs are not configured for the selected period
            </div>
          </div>
        ) : (
          filtered.map((slo) => {
            const trendKey = slo.trend ?? "flat"
            const statusKey = slo.status ?? "neutral"
            const TrendIcon = trendIcon[trendKey]
            const cfg       = statusConfig[statusKey]
            const pct =
              slo.current !== null ? Math.min(100, (slo.current / slo.target) * 100) : 0

            return (
              <div
                key={slo.id}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-zinc-900/50 transition-colors"
              >
                {/* Status dot */}
                <div className="w-5 shrink-0 flex items-center">
                  <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                </div>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {slo.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
                        cfg.bg,
                        cfg.color,
                        cfg.border,
                      )}
                    >
                      {statusKey.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {slo.description}
                  </p>
                </div>

                {/* Current / target */}
                <div className="w-32 shrink-0 text-right">
                  <span className="text-sm font-semibold tabular-nums text-zinc-100">
                    {slo.current !== null ? slo.current.toFixed(1) : "—"}
                    {slo.current !== null ? slo.unit : ""}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {" "}
                    / {slo.target}
                    {slo.unit}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-36 shrink-0">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        statusKey === "healthy"
                          ? "bg-emerald-500"
                          : statusKey === "at_risk"
                            ? "bg-amber-500"
                            : statusKey === "breached"
                              ? "bg-red-500"
                              : "bg-zinc-600",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-700 mt-0.5 text-right tabular-nums">
                    {slo.current !== null ? `${pct.toFixed(0)}%` : "—"}
                  </div>
                </div>

                {/* Trend */}
                <div className="w-16 shrink-0 flex justify-end">
                  <TrendIcon
                    className={cn("w-3.5 h-3.5", trendColor[trendKey])}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
