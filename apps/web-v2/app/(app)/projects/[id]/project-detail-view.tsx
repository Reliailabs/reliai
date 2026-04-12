"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { MetricTile } from "@/components/metric-tile"
import { Sparkline } from "@/components/charts/sparkline"
import { cn } from "@/lib/utils"
import type {
  GuardrailMetrics,
  TimelineResponse,
  TimelineEventRead,
  ModelVersionListResponse,
  ModelVersionRead,
  ProjectReliabilityRead,
  DeploymentListResponse,
  DeploymentRead,
} from "@reliai/types"

type Tab = "overview" | "control" | "guardrails" | "models" | "timeline" | "reliability" | "deployments" | "metrics" | "ingestion" | "processors" | "settings"
type Severity = "critical" | "high" | "medium" | "low"

type ProjectDetailData = {
  id: string
  name: string
  env: "production" | "staging" | "development"
  model: string
  errorRate: number
  p95Latency: number
  tracesPerDay: string
}

export type GuardrailPolicyRow = {
  id: string
  name: string
  type: string
  threshold: string
  enabled: boolean
  actionsLast24h: number
  truePositives: number
  falsePositives: number
}

export type ProjectIncidentRow = {
  id: string
  title: string
  severity: Severity
  age: string
}

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

const reliabilityPatterns = [
  { id: "pattern-1", pattern: "Refusal spikes on policy enforcement", severity: "high" as Severity, frequency: 12, lastSeen: "2h ago" },
  { id: "pattern-2", pattern: "Latency regressions after prompt edits", severity: "medium" as Severity, frequency: 8, lastSeen: "6h ago" },
  { id: "pattern-3", pattern: "Unexpected cost jumps on retries", severity: "low" as Severity, frequency: 4, lastSeen: "1d ago" },
]

const hourlyErrorRate = [1.4, 2.1, 2.8, 3.6, 2.3, 1.8, 2.6, 2.0, 1.4, 1.1, 2.0, 1.6]

export function ProjectDetailView({
  project,
  guardrailPolicies,
  openIncidents,
  guardrailMetrics,
  cost,
  timeline,
  reliability,
  deployments,
  modelVersions,
}: {
  project: ProjectDetailData
  guardrailPolicies: GuardrailPolicyRow[]
  openIncidents: ProjectIncidentRow[]
  guardrailMetrics: GuardrailMetrics | null
  cost: any | null // eslint-disable-line @typescript-eslint/no-explicit-any
  timeline: TimelineResponse | null
  reliability: ProjectReliabilityRead | null
  deployments: DeploymentListResponse | null
  modelVersions: ModelVersionListResponse | null
}) {
  const [tab, setTab] = useState<Tab>("overview")

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
    { key: "timeline", label: "Timeline" },
    { key: "control",  label: "Control Panel" },
    { key: "reliability", label: "Reliability" },
    { key: "guardrails", label: "Guardrails" },
    { key: "models", label: "Models" },
    { key: "deployments", label: "Deployments" },
    { key: "metrics", label: "Metrics" },
    { key: "ingestion", label: "Ingestion" },
    { key: "processors", label: "Processors" },
    { key: "settings", label: "Settings" },
  ]

  const tabHrefs: Record<Tab, string> = {
    overview: "",
    timeline: `/projects/${project.id}/timeline`,
    control: `/projects/${project.id}/control`,
    reliability: `/projects/${project.id}/reliability`,
    guardrails: `/projects/${project.id}/guardrails`,
    models: "",
    deployments: `/projects/${project.id}/deployments`,
    metrics: `/projects/${project.id}/metrics`,
    ingestion: `/projects/${project.id}/ingestion`,
    processors: `/projects/${project.id}/processors`,
    settings: `/projects/${project.id}/settings`,
  }

  return (
    <div className="min-h-full">
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

      <div className="flex gap-0 border-b border-zinc-800 px-6">
        {tabs.map((t) => {
          const href = tabHrefs[t.key]
          const isExternal = href !== ""
          const isActive = tab === t.key
          return isExternal ? (
            <Link
              key={t.key}
              href={href}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors -mb-px",
                isActive
                  ? "text-zinc-100 border-b-2 border-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
              )}
            >
              {t.label}
            </Link>
          ) : (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors -mb-px",
                isActive
                  ? "text-zinc-100 border-b-2 border-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="p-6 space-y-6">
        {tab === "overview" && (
          <>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricTile
                label="Guardrail Actions"
                value={guardrailMetrics?.recent_events?.length?.toLocaleString() ?? "0"}
                tone="neutral"
              />
              <MetricTile
                label="Total Cost"
                value={cost?.total_cost != null ? `$${cost.total_cost.toFixed(2)}` : "—"}
                tone="neutral"
              />
              <MetricTile
                label="Timeline Events"
                value={timeline?.items?.length?.toLocaleString() ?? "0"}
                tone="neutral"
              />
            </div>

            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
                Open Incidents
              </div>
              {openIncidents.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                  No open incidents
                </div>
              ) : (
                <div className="space-y-2">
                  {openIncidents.map((inc) => (
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

        {tab === "control" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {tab === "guardrails" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">
                Guardrail Policies
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  <span className="tabular-nums text-zinc-200 font-medium">
                    {guardrailPolicies.reduce((s, p) => s + p.actionsLast24h, 0).toLocaleString()}
                  </span>{" "}
                  actions last 24h
                </span>
                <Link
                  href={`/projects/${project.id}/guardrails`}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Full dashboard
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

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
                    <div className="w-5 shrink-0 flex items-center">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        policy.enabled ? "bg-emerald-500" : "bg-zinc-600"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100 truncate">{policy.name}</span>
                        <span className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800",
                          guardrailTypeColor[policy.type] ?? "text-zinc-400"
                        )}>
                          {policy.type}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{policy.threshold}</div>
                    </div>

                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm tabular-nums font-medium text-zinc-200">
                        {policy.actionsLast24h.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-16 text-right shrink-0">
                      <span className="text-xs tabular-nums text-emerald-400">{policy.truePositives}</span>
                    </div>

                    <div className="w-16 text-right shrink-0">
                      <span className={cn(
                        "text-xs tabular-nums",
                        policy.falsePositives > 0 ? "text-red-400" : "text-zinc-600"
                      )}>
                        {policy.falsePositives}
                      </span>
                    </div>

                    <div className="w-16 text-right shrink-0">
                      {total > 0 ? (
                        <span className={cn("text-xs tabular-nums font-medium", fprTone)}>
                          {fpr.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === "timeline" && timeline && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Timeline Events
            </div>
            {timeline.items && timeline.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Time</div>
                  <div>Event Type</div>
                  <div>Environment</div>
                  <div className="text-right">Details</div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                    {timeline.items.map((event: TimelineEventRead, index) => (
                     <div
                       key={index}
                       className="grid grid-cols-4 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors"
                     >
                       <div className="text-sm text-zinc-400">
                         {new Date(event.timestamp).toLocaleString()}
                      </div>
                      <div className="text-sm font-medium text-zinc-100">
                        {event.event_type}
                      </div>
                       <div className="text-sm text-zinc-500">
                         {(event as TimelineEventRead & { environment?: string }).environment ?? "—"}
                       </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-600">
                           {event.metadata ? "View" : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No timeline events found
              </div>
            )}
          </div>
        )}

        {tab === "reliability" && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Reliability Metrics
            </div>
            {reliability ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="text-xs font-medium text-zinc-400">Quality Pass Rate</div>
                  <div className="text-2xl font-semibold text-zinc-100 mt-1">
                    {reliability.quality_pass_rate != null ? `${(reliability.quality_pass_rate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="text-xs font-medium text-zinc-400">Detection Latency p90</div>
                  <div className="text-2xl font-semibold text-zinc-100 mt-1">
                    {reliability.detection_latency_p90 != null ? `${reliability.detection_latency_p90} ms` : "—"}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                   <div className="text-xs font-medium text-zinc-400">Detection Latency p90</div>
                  <div className="text-2xl font-semibold text-zinc-100 mt-1">
                     {reliability.detection_latency_p90 != null ? `${reliability.detection_latency_p90} ms` : "—"}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                   <div className="text-xs font-medium text-zinc-400">Quality Pass Rate</div>
                   <div className="text-2xl font-semibold text-zinc-100 mt-1">
                     {reliability.quality_pass_rate != null ? `${(reliability.quality_pass_rate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                   <div className="text-xs font-medium text-zinc-400">Traces (24h)</div>
                   <div className="text-2xl font-semibold text-zinc-100 mt-1">
                     {reliability.traces_last_24h != null ? `${reliability.traces_last_24h.toLocaleString()}` : "—"}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                   <div className="text-xs font-medium text-zinc-400">Structured Output Validity</div>
                   <div className="text-2xl font-semibold text-zinc-100 mt-1">
                     {reliability.structured_output_validity_rate != null ? `${(reliability.structured_output_validity_rate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No reliability data available
              </div>
            )}
          </div>
        )}

        {tab === "deployments" && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Deployments
            </div>
            {deployments && deployments.items && deployments.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Environment</div>
                  <div>Deployed At</div>
                  <div>Prompt Version</div>
                  <div>Model Version</div>
                  <div className="text-right">Status</div>
                </div>
                 <div className="divide-y divide-zinc-800/40">
                    {deployments.items.map((deployment: DeploymentRead) => (
                     <Link
                       key={deployment.id}
                       href={`/deployments/${deployment.id}`}
                       className="grid grid-cols-5 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors"
                     >
                       <div className="text-sm font-medium text-zinc-100">
                         {deployment.environment}
                       </div>
                       <div className="text-sm text-zinc-400">
                         {new Date(deployment.deployed_at).toLocaleString()}
                       </div>
                       <div className="text-sm text-zinc-500">
                         {deployment.prompt_version_id ? (
                           <Link href={`/prompt-versions/${deployment.prompt_version_id}?projectId=${project.id}`} className="hover:text-zinc-300" onClick={(e) => e.stopPropagation()}>
                             {deployment.prompt_version_id.slice(0, 8)}
                           </Link>
                         ) : "—"}
                       </div>
                       <div className="text-sm text-zinc-500">
                         {deployment.model_version_id ? (
                           <Link href={`/model-versions/${deployment.model_version_id}?projectId=${project.id}`} className="hover:text-zinc-300" onClick={(e) => e.stopPropagation()}>
                             {deployment.model_version_id.slice(0, 8)}
                           </Link>
                         ) : "—"}
                       </div>
                       <div className="text-right">
                         <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                           deployed
                         </span>
                       </div>
                     </Link>
                   ))}
                 </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No deployments found
              </div>
            )}
          </div>
        )}

        {tab === "metrics" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-8 text-center">
            <p className="text-sm text-zinc-400">Custom metrics management is now a dedicated page.</p>
            <Link
              href={`/projects/${project.id}/metrics`}
              className="inline-flex items-center gap-2 mt-4 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Go to Metrics page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {tab === "ingestion" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-8 text-center">
            <p className="text-sm text-zinc-400">Ingestion pipeline configuration is now a dedicated page.</p>
            <Link
              href={`/projects/${project.id}/ingestion`}
              className="inline-flex items-center gap-2 mt-4 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Go to Ingestion page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {tab === "processors" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-8 text-center">
            <p className="text-sm text-zinc-400">External processors management is now a dedicated page.</p>
            <Link
              href={`/projects/${project.id}/processors`}
              className="inline-flex items-center gap-2 mt-4 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Go to Processors page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {tab === "settings" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-8 text-center">
            <p className="text-sm text-zinc-400">Project settings are now a dedicated page.</p>
            <Link
              href={`/projects/${project.id}/settings`}
              className="inline-flex items-center gap-2 mt-4 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Go to Settings page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {tab === "models" && modelVersions && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Model Versions
            </div>
            {modelVersions.items && modelVersions.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Model Version</div>
                  <div>Model Name</div>
                  <div>Provider</div>
                  <div className="text-right">Created</div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                   {modelVersions.items.map((mv: ModelVersionRead) => (
                     <Link
                       key={mv.id}
                       href={`/model-versions/${mv.id}?projectId=${project.id}`}
                       className="grid grid-cols-4 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors"
                     >
                       <div className="text-sm font-medium text-zinc-100">{mv.model_version ?? "—"}</div>
                       <div className="text-sm text-zinc-400">{mv.model_name}</div>
                       <div className="text-sm text-zinc-500">{mv.provider ?? "—"}</div>
                       <div className="text-right">
                         <span className="text-xs text-zinc-600">
                           {new Date(mv.created_at).toLocaleDateString()}
                         </span>
                       </div>
                     </Link>
                   ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No model versions found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
