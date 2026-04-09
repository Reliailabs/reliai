"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { deployments } from "@/lib/mock-data"
import type { DeploymentRecord, DeploymentStatus, GateStatus, RiskFactor } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// ── Status dot ────────────────────────────────────────────────────────────────

const statusDotColor: Record<DeploymentStatus, string> = {
  live:         "bg-emerald-500",
  pending:      "bg-amber-500",
  failed:       "bg-red-500",
  rolled_back:  "bg-zinc-600",
}

// ── Risk pill ─────────────────────────────────────────────────────────────────

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

// ── Gate badge ────────────────────────────────────────────────────────────────

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

// ── Risk bar ──────────────────────────────────────────────────────────────────

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

// ── Deployment row ────────────────────────────────────────────────────────────

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
      {/* Main row */}
      <div
        onClick={onToggle}
        className={cn(
          "group flex items-center gap-0 border-b border-zinc-800/40 transition-colors cursor-pointer",
          expanded ? "bg-zinc-900/80" : "hover:bg-zinc-900/50"
        )}
      >
        {/* Expand chevron */}
        <div className="w-9 shrink-0 flex items-center justify-center py-3.5 pl-2">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
          )}
        </div>

        {/* Status dot */}
        <div className="w-6 shrink-0 flex items-center justify-center py-3.5">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              statusDotColor[dep.status]
            )}
          />
        </div>

        {/* Deployment name + version */}
        <div className="w-52 shrink-0 py-3.5 pr-3 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-medium text-zinc-100 truncate leading-snug">
              {dep.name}
            </span>
            <span className="font-mono text-xs text-zinc-500 shrink-0">{dep.version}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 truncate">{dep.project}</div>
        </div>

        {/* Model */}
        <div className="w-36 shrink-0 py-3.5 hidden md:block">
          <span className="font-mono text-xs text-zinc-400">{dep.model}</span>
        </div>

        {/* Risk score */}
        <div className="w-28 shrink-0 py-3.5">
          <RiskPill score={dep.riskScore} />
        </div>

        {/* Gate status */}
        <div className="w-24 shrink-0 py-3.5">
          <GateBadge status={dep.gateStatus} />
        </div>

        {/* Age */}
        <div className="w-20 shrink-0 py-3.5 hidden sm:block">
          <span className="text-xs text-zinc-600 tabular-nums">{dep.age}</span>
        </div>

        {/* Actions */}
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

      {/* Expanded detail */}
      {expanded && (
        <div className="border-b border-zinc-800/40 bg-zinc-900/60 px-6 py-4">
          {/* Rollback confirm */}
          {showRollbackConfirm && (
            <div className="mb-4 border border-red-500/30 bg-red-500/5 rounded-lg px-4 py-3 flex items-center gap-4">
              <span className="text-sm text-red-300">
                Confirm rollback to <span className="font-mono font-medium">{dep.baseline}</span>?
              </span>
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  onClick={() => onRollbackConfirm(dep.id)}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                >
                  Confirm rollback
                </button>
                <button
                  onClick={onRollbackCancel}
                  className="text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-800 px-3 py-1 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-8 flex-wrap">
            {/* Risk breakdown */}
            <div className="w-72 shrink-0">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
                Risk Breakdown
              </div>
              <div className="flex flex-col gap-2">
                {dep.riskFactors.map((rf) => (
                  <RiskBar key={rf.factor} factor={rf.factor} score={rf.score} />
                ))}
              </div>
            </div>

            {/* Deployment info */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
                Deployment Info
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                <InfoField label="Triggered by" value={dep.triggeredBy} />
                <InfoField label="Commit" value={dep.commit} mono />
                <InfoField label="Baseline" value={dep.baseline} mono />
                <InfoField
                  label="Eval runs"
                  value={`${dep.evalsPassed} passed / ${dep.evalsTotal} total`}
                />
                <InfoField
                  label="Guardrail checks"
                  value={`${dep.guardrailsPassed} / ${dep.guardrailsTotal} passed`}
                />
                <InfoField label="Deploy time" value={dep.deployedAt} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">{label}</div>
      <div
        className={cn(
          "text-xs text-zinc-300 truncate",
          mono && "font-mono"
        )}
      >
        {value}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeploymentsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rollbackConfirmId, setRollbackConfirmId] = useState<string | null>(null)

  const deployed    = deployments.filter((d) => d.status === "live").length
  const atRisk      = deployments.filter((d) => d.status === "live" && d.riskScore >= 60).length
  const rolledBack  = deployments.filter((d) => d.status === "rolled_back").length

  function handleToggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setRollbackConfirmId(null)
    } else {
      setExpandedId(id)
      setRollbackConfirmId(null)
    }
  }

  function handleRollbackRequest(id: string) {
    // Ensure the row is expanded when confirm UI appears
    setExpandedId(id)
    setRollbackConfirmId(id)
  }

  function handleRollbackCancel() {
    setRollbackConfirmId(null)
  }

  function handleRollbackConfirm(_id: string) {
    // In production this would fire an API call; for now just dismiss
    setRollbackConfirmId(null)
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <PageHeader
        title="Deployments"
        description="Deployment gates, risk scoring, and rollback controls."
        right={
          <button className="inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded transition-colors">
            New deployment
          </button>
        }
      />

      {/* Summary bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900/40">
        <StatChip
          value={deployed}
          label="deployed"
          valueClass="text-zinc-200"
        />
        <span className="text-zinc-700">·</span>
        <StatChip
          value={atRisk}
          label="at risk"
          valueClass="text-amber-400"
        />
        <span className="text-zinc-700">·</span>
        <StatChip
          value={rolledBack}
          label="rolled back"
          valueClass="text-zinc-400"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {/* Sticky header */}
        <div className="flex items-center gap-0 pr-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm text-[10px] font-semibold text-zinc-600 uppercase tracking-wider min-w-[860px]">
          {/* chevron spacer */}
          <div className="w-9 shrink-0" />
          {/* dot spacer */}
          <div className="w-6 shrink-0">
            <span className="sr-only">Status</span>
          </div>
          <div className="w-52 shrink-0">Deployment</div>
          <div className="w-36 shrink-0 hidden md:block">Model</div>
          <div className="w-28 shrink-0">Risk</div>
          <div className="w-24 shrink-0">Gate</div>
          <div className="w-20 shrink-0 hidden sm:block">Age</div>
          <div className="flex-1 text-right">Actions</div>
        </div>

        {/* Rows */}
        <div className="min-w-[860px]">
          {deployments.map((dep) => (
            <DeploymentRow
              key={dep.id}
              dep={dep}
              expanded={expandedId === dep.id}
              onToggle={() => handleToggle(dep.id)}
              rollbackConfirmId={rollbackConfirmId}
              onRollbackRequest={handleRollbackRequest}
              onRollbackCancel={handleRollbackCancel}
              onRollbackConfirm={handleRollbackConfirm}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatChip({
  value,
  label,
  valueClass,
}: {
  value: number
  label: string
  valueClass: string
}) {
  return (
    <span className="text-xs tabular-nums">
      <span className={cn("font-medium", valueClass)}>{value}</span>
      <span className="text-zinc-500 ml-1">{label}</span>
    </span>
  )
}
