"use client"

import { use, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { MetricTile } from "@/components/metric-tile"
import { Sparkline } from "@/components/charts/sparkline"
import {
  projectDetails,
  guardrailPolicies,
  reliabilityPatterns,
  incidents,
  hourlyErrorRate,
} from "@/lib/mock-data"
import type { Severity } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type Tab = "overview" | "control" | "guardrails"

const severityBorderColor: Record<Severity, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#3b82f6",
}

const guardrailTypeColor: Record<string, string> = {
  refusal:  "text-amber-400",
  pii:      "text-violet-400",
  toxicity: "text-rose-400",
  latency:  "text-sky-400",
  cost:     "text-emerald-400",
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [tab, setTab] = useState<Tab>("overview")

  const project = projectDetails[id]

  if (!project) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-medium text-zinc-400">Project not found</div>
          <div className="text-xs text-zinc-600 mt-1">No project with id &ldquo;{id}&rdquo;</div>
          <Link href="/projects" className="mt-3 inline-block text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  const projectIncidents = incidents.filter(
    (inc) => inc.project === project.name && inc.status !== "resolved"
  )

  const errorRateTone =
    project.errorRate > 10 ? "critical"
    : project.errorRate > 3 ? "warning"
    : "stable"

  const latencyTone =
    project.p95Latency > 1500 ? "critical"
    : project.p95Latency > 800 ? "warning"
    : "stable"

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "control",  label: "Control Panel" },
    { key: "guardrails", label: "Guardrails" },
  ]

  return (
    <div className="min-h-full">
      {/* Page header */}
      <PageHeader
        title={project.name}
        description={`${project.env} · ${project.model}`}
        right={
          <>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border",
                project.env === "production"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}
            >
              {project.env}
            </span>
            <Link
              href="/traces"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              View traces →
            </Link>
          </>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-zinc-800 px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors -mb-px",
              tab === t.key
                ? "text-zinc-100 border-b-2 border-zinc-200"
                : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6 space-y-6">
        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <>
            {/* Metric tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricTile
                label="Error Rate"
                value={`${project.errorRate}%`}
                tone={errorRateTone}
              />
              <MetricTile
                label="p95 Latency"
                value={`${project.p95Latency}ms`}
                tone={latencyTone}
              />
              <MetricTile
                label="Traces / day"
                value={project.tracesPerDay}
                tone="neutral"
              />
            </div>

            {/* Open incidents */}
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
                Open Incidents
              </div>
              {projectIncidents.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                  No open incidents
                </div>
              ) : (
                <div className="space-y-2">
                  {projectIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                    >
                      <div
                        className="w-0.5 self-stretch shrink-0"
                        style={{ backgroundColor: severityBorderColor[inc.severity] }}
                      />
                      <div className="flex items-center gap-3 flex-1 py-3 pr-4 min-w-0">
                        <SeverityBadge severity={inc.severity} className="shrink-0" />
                        <span className="text-sm text-zinc-200 truncate flex-1">
                          {inc.title}
                        </span>
                        <span className="text-xs text-zinc-600 tabular-nums shrink-0">
                          {inc.age}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Control Panel tab ── */}
        {tab === "control" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reliability Patterns */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300">
                  Reliability Patterns
                </span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                  last 7d
                </span>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {reliabilityPatterns.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 overflow-hidden"
                  >
                    <div
                      className="w-0.5 self-stretch shrink-0"
                      style={{ backgroundColor: severityBorderColor[p.severity] }}
                    />
                    <div className="flex items-center justify-between flex-1 py-3 pr-4 gap-3 min-w-0">
                      <span className="text-sm text-zinc-200 flex-1 leading-snug min-w-0">
                        {p.pattern}
                      </span>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs tabular-nums text-zinc-400 font-medium">
                          {p.frequency.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {p.lastSeen}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Rate Trend */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300">
                  Error Rate
                </span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                  24h
                </span>
              </div>
              <div className="px-4 pt-3 pb-2">
                <Sparkline
                  data={hourlyErrorRate}
                  color="#ef4444"
                  gradientId="proj-err-rate"
                  height={100}
                />
              </div>
              <div className="px-4 py-3 border-t border-zinc-800 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                    p95 Latency
                  </div>
                  <div
                    className={cn(
                      "text-xl font-semibold tabular-nums mt-1 leading-none tracking-tight",
                      latencyTone === "critical" ? "text-red-400"
                      : latencyTone === "warning" ? "text-amber-400"
                      : "text-zinc-50"
                    )}
                  >
                    {project.p95Latency}ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                    Traces / day
                  </div>
                  <div className="text-xl font-semibold tabular-nums mt-1 leading-none tracking-tight text-zinc-50">
                    {project.tracesPerDay}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Guardrails tab ── */}
        {tab === "guardrails" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">
                Guardrail Policies
              </span>
              <span className="text-xs text-zinc-500">
                <span className="tabular-nums text-zinc-200 font-medium">
                  {guardrailPolicies.reduce((s, p) => s + p.actionsLast24h, 0).toLocaleString()}
                </span>{" "}
                actions last 24h
              </span>
            </div>

            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-2 border border-zinc-800 rounded-t-lg bg-zinc-950/60 -mt-2">
              <div className="w-5 shrink-0" />
              <div className="flex-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Policy</div>
              <div className="w-20 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">Actions</div>
              <div className="w-16 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">TP</div>
              <div className="w-16 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">FP</div>
              <div className="w-16 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">FPR</div>
            </div>
            <div className="border border-t-0 border-zinc-800 rounded-b-lg overflow-hidden divide-y divide-zinc-800/40 -mt-0">
              {guardrailPolicies.map((policy) => {
                const total = policy.truePositives + policy.falsePositives
                const fpr   = total > 0 ? (policy.falsePositives / total) * 100 : 0
                const fprTone = fpr > 20 ? "text-red-400" : fpr > 10 ? "text-amber-400" : "text-emerald-400"

                return (
                  <div
                    key={policy.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/40 transition-colors",
                      !policy.enabled && "opacity-50"
                    )}
                  >
                    {/* Status dot */}
                    <div className="w-5 shrink-0 flex items-center">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        policy.enabled ? "bg-emerald-500" : "bg-zinc-600"
                      )} />
                    </div>

                    {/* Name + threshold */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100 truncate">{policy.name}</span>
                        <span className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800",
                          guardrailTypeColor[policy.type]
                        )}>
                          {policy.type}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{policy.threshold}</div>
                    </div>

                    {/* Actions 24h */}
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm tabular-nums font-medium text-zinc-200">
                        {policy.actionsLast24h.toLocaleString()}
                      </span>
                    </div>

                    {/* True positives */}
                    <div className="w-16 text-right shrink-0">
                      <span className="text-xs tabular-nums text-emerald-400">{policy.truePositives}</span>
                    </div>

                    {/* False positives */}
                    <div className="w-16 text-right shrink-0">
                      <span className={cn(
                        "text-xs tabular-nums",
                        policy.falsePositives > 0 ? "text-red-400" : "text-zinc-600"
                      )}>
                        {policy.falsePositives}
                      </span>
                    </div>

                    {/* FPR % */}
                    <div className="w-16 text-right shrink-0">
                      {total > 0 ? (
                        <span className={cn("text-xs tabular-nums font-medium", fprTone)}>
                          {fpr.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
