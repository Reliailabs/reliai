"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

export type DeploymentStatus = "live" | "pending" | "failed" | "rolled_back"
export type GateStatus = "pass" | "fail" | "pending" | "skipped"

export type RiskFactor = {
  factor: string
  score: number
}

export type DeploymentRecord = {
  id: string
  name: string
  version: string
  project: string
  model: string
  status: DeploymentStatus
  gateStatus: GateStatus
  riskScore: number
  riskFactors: RiskFactor[]
  age: string
  triggeredBy?: string | null
  commit?: string | null
  baseline?: string | null
  evalsPassed?: number | null
  evalsTotal?: number | null
  guardrailsPassed?: number | null
  guardrailsTotal?: number | null
  deployedAt?: string | null
}

const statusDotColor: Record<DeploymentStatus, string> = {
  live:         "bg-emerald-500",
  pending:      "bg-amber-500",
  failed:       "bg-red-500",
  rolled_back:  "bg-zinc-600",
}

function RiskPill({ score }: { score: number }) {
  if (score <= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 tabular-nums">
        LOW · {score}
      </span>
    )
  }
  if (score <= 60) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20 tabular-nums">
        MED · {score}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border bg-red-500/10 text-red-400 border-red-500/20 tabular-nums">
      HIGH · {score}
    </span>
  )
}

const gateConfig: Record<GateStatus, string> = {
  pass:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  fail:    "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  skipped: "bg-zinc-700/50 text-zinc-500 border-zinc-700/50",
}

function GateBadge({ status }: { status: GateStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
        gateConfig[status]
      )}
    >
      {status}
    </span>
  )
}

function RiskBar({ factor, score }: RiskFactor) {
  const fillColor =
    score > 60 ? "bg-red-500" : score > 30 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex items-center gap-2">
      <span className="w-40 shrink-0 text-xs text-zinc-400 truncate font-mono">{factor}</span>
      <div className="flex-1 bg-zinc-800 rounded h-1.5 overflow-hidden">
        <div
          className={cn("h-full rounded transition-all", fillColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-xs text-zinc-500 tabular-nums">{score}</span>
    </div>
  )
}

function DeploymentRow({
  dep,
  expanded,
  onToggle,
  rollbackConfirmId,
  onRollbackRequest,
  onRollbackCancel,
  onRollbackConfirm,
}: {
  dep: DeploymentRecord
  expanded: boolean
  onToggle: () => void
  rollbackConfirmId: string | null
  onRollbackRequest: (id: string) => void
  onRollbackCancel: () => void
  onRollbackConfirm: (id: string) => void
}) {
  const showRollbackConfirm = rollbackConfirmId === dep.id

  return (
    <>
      <div
        onClick={onToggle}
        className={cn(
          "group flex items-center gap-0 border-b border-zinc-800/40 transition-colors cursor-pointer",
          expanded ? "bg-zinc-900/80" : "hover:bg-zinc-900/50"
        )}
      >
        <div className="w-9 shrink-0 flex items-center justify-center py-3.5 pl-2">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
          )}
        </div>

        <div className="w-6 shrink-0 flex items-center justify-center py-3.5">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              statusDotColor[dep.status]
            )}
          />
        </div>

        <div className="w-52 shrink-0 py-3.5 pr-3 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-medium text-zinc-100 truncate leading-snug">
              {dep.name}
            </span>
            <span className="font-mono text-xs text-zinc-500 shrink-0">{dep.version}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 truncate">{dep.project}</div>
        </div>

        <div className="w-36 shrink-0 py-3.5 hidden md:block">
          <span className="font-mono text-xs text-zinc-400">{dep.model}</span>
        </div>

        <div className="w-28 shrink-0 py-3.5">
          <RiskPill score={dep.riskScore} />
        </div>

        <div className="w-24 shrink-0 py-3.5">
          <GateBadge status={dep.gateStatus} />
        </div>

        <div className="w-20 shrink-0 py-3.5 hidden sm:block">
          <span className="text-xs text-zinc-600 tabular-nums">{dep.age}</span>
        </div>

        <div
          className="flex-1 min-w-0 py-3.5 pr-4 flex items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {dep.status === "live" && dep.riskScore >= 60 && (
            <button
              onClick={() => onRollbackRequest(dep.id)}
              className="text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
            >
              Rollback
            </button>
          )}
          {dep.status === "pending" && (
            <>
              <button className="text-xs border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-2 py-0.5 rounded transition-colors">
                Approve
              </button>
              <button className="text-xs border border-zinc-700 text-zinc-500 hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors">
                Block
              </button>
            </>
          )}
          {dep.status === "live" && dep.riskScore < 60 && (
            <button
              onClick={() => {/* noop */}}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Details →
            </button>
          )}
          {(dep.status === "rolled_back" || dep.status === "failed") && (
            <button className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              View post-mortem →
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="bg-zinc-950/60 border-b border-zinc-800/40 px-6 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Triggered By
              </div>
              <div className="text-sm text-zinc-200 mt-1">{dep.triggeredBy ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Commit
              </div>
              <div className="text-sm font-mono text-zinc-200 mt-1">{dep.commit ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Baseline
              </div>
              <div className="text-sm font-mono text-zinc-200 mt-1">{dep.baseline ?? "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                Evaluations
              </div>
              <div className="text-sm text-zinc-200">
                {dep.evalsPassed ?? 0} / {dep.evalsTotal ?? 0} passed
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                Guardrails
              </div>
              <div className="text-sm text-zinc-200">
                {dep.guardrailsPassed ?? 0} / {dep.guardrailsTotal ?? 0} passed
              </div>
            </div>
          </div>

          {showRollbackConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Confirm rollback?</span>
              <button
                onClick={onRollbackCancel}
                className="text-xs border border-zinc-700 text-zinc-500 hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onRollbackConfirm(dep.id)}
                className="text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
              >
                Confirm
              </button>
            </div>
          )}

          {dep.riskFactors.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                Risk factors
              </div>
              <div className="space-y-2">
                {dep.riskFactors.map((factor) => (
                  <RiskBar key={factor.factor} {...factor} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function DeploymentsView({ deployments }: { deployments: DeploymentRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rollbackConfirmId, setRollbackConfirmId] = useState<string | null>(null)

  return (
    <div className="min-h-full">
      <PageHeader
        title="Deployments"
        description="Track and govern model deployments across your projects."
      />

      <div className="divide-y divide-zinc-800/40">
        {deployments.map((dep) => (
          <DeploymentRow
            key={dep.id}
            dep={dep}
            expanded={expandedId === dep.id}
            onToggle={() => setExpandedId(expandedId === dep.id ? null : dep.id)}
            rollbackConfirmId={rollbackConfirmId}
            onRollbackRequest={(id) => setRollbackConfirmId(id)}
            onRollbackCancel={() => setRollbackConfirmId(null)}
            onRollbackConfirm={() => setRollbackConfirmId(null)}
          />
        ))}
      </div>
    </div>
  )
}
