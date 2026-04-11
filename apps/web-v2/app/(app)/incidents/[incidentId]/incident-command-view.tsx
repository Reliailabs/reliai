"use client"

import { useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Clock,
  Zap,
  Shield,
  GitBranch,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { IncidentCommandCenterRead } from "@reliai/types"
import {
  acknowledgeIncident,
  resolveIncident,
  reopenIncident,
} from "./actions"

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "—"
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function renderPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatPrimitive(value: unknown): string | null {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return null
}

function formatEvidence(evidence: Record<string, unknown> | null): string[] {
  if (!evidence) return []
  return Object.entries(evidence).flatMap(([key, value]) => {
    if (value === null || value === undefined) return []
    const primitive = formatPrimitive(value)
    if (primitive !== null) return `${key.replaceAll("_", " ")}: ${primitive}`
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        const p = formatPrimitive(item)
        if (p !== null) return `${key.replaceAll("_", " ")}: ${p}`
        return []
      })
    }
    return []
  })
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 border-red-500/30 bg-red-500/10",
  high:     "text-amber-400 border-amber-500/30 bg-amber-500/10",
  medium:   "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  low:      "text-blue-400 border-blue-500/30 bg-blue-500/10",
}
const SEVERITY_BAR: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-500",
  medium:   "bg-yellow-500",
  low:      "bg-blue-500",
}
const STATUS_COLOR: Record<string, string> = {
  open:     "text-red-400",
  resolved: "text-emerald-400",
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-3.5 h-3.5 text-zinc-600" />}
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  onClick,
  pending,
  variant = "default",
  children,
}: {
  onClick: () => void
  pending: boolean
  variant?: "default" | "danger" | "success"
  children: React.ReactNode
}) {
  const colors = {
    default: "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
    danger:  "border-red-800/60 text-red-400 hover:border-red-700 hover:text-red-300",
    success: "border-emerald-800/60 text-emerald-400 hover:border-emerald-700 hover:text-emerald-300",
  }
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        colors[variant],
      )}
    >
      {children}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  incidentId: string
  command: IncidentCommandCenterRead
}

export function IncidentCommandView({ incidentId, command }: Props) {
  const [isPending, startTransition] = useTransition()
  const incident = command.incident
  const summary  = incident.summary_json ?? {}
  const metric   = command.metric ?? null

  const metricName  = metric?.display_name ?? metric?.metric_name ?? String(summary.metric_name ?? "metric")
  const currentVal  = metric?.value ?? (summary.current_value ? String(summary.current_value) : null)
  const baselineVal = metric?.baseline_value ?? (summary.baseline_value ? String(summary.baseline_value) : null)
  const deltaPct    = metric?.delta_percent ?? (summary.delta_percent ? String(summary.delta_percent) : null)

  const rootCause       = command.root_cause
  const topCause        = rootCause.root_cause_probabilities[0]
  const evidenceLines   = formatEvidence(rootCause.evidence).slice(0, 12)
  const confidence      = rootCause.top_root_cause_probability ?? topCause?.probability ?? null

  const isOpen     = incident.status === "open"
  const isAcked    = Boolean(incident.acknowledged_at)

  function run(fn: (id: string) => Promise<void>) {
    startTransition(() => { fn(incidentId).catch(() => {}) })
  }

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/60">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All incidents
        </Link>
        <Link
          href={`/post-mortem/${incidentId}`}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          View post-mortem →
        </Link>
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/60">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0 mt-0.5",
                  SEVERITY_BAR[incident.severity] ?? "bg-zinc-600",
                )}
              />
              <h1 className="text-base font-semibold text-zinc-100 truncate">
                {incident.title}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border shrink-0",
                  SEVERITY_COLOR[incident.severity] ?? "text-zinc-400 border-zinc-700 bg-zinc-800/40",
                )}
              >
                {incident.severity}
              </span>
              <span className={cn("text-xs font-medium", STATUS_COLOR[incident.status] ?? "text-zinc-400")}>
                {incident.status}
              </span>
              {isAcked && (
                <span className="text-[10px] text-zinc-500 border border-zinc-700/60 rounded px-1.5 py-0.5 tracking-wide">
                  acknowledged
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
              <span>{incident.project_name}</span>
              <span className="text-zinc-700">·</span>
              <span>{formatRelative(incident.started_at)}</span>
              <span className="text-zinc-700">·</span>
              <span className="font-mono text-zinc-600">{incident.incident_type}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isOpen && !isAcked && (
              <ActionButton
                onClick={() => run(acknowledgeIncident)}
                pending={isPending}
                variant="default"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Acknowledge
              </ActionButton>
            )}
            {isOpen && (
              <ActionButton
                onClick={() => run(resolveIncident)}
                pending={isPending}
                variant="success"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve
              </ActionButton>
            )}
            {!isOpen && (
              <ActionButton
                onClick={() => run(reopenIncident)}
                pending={isPending}
                variant="danger"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen
              </ActionButton>
            )}
          </div>
        </div>

        {/* Metric signals */}
        {(currentVal || baselineVal) && (
          <div className="flex items-center gap-4 mt-3">
            {currentVal && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{metricName}</span>
                <span className="text-sm font-semibold tabular-nums text-zinc-100">{currentVal}</span>
              </div>
            )}
            {baselineVal && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">baseline</span>
                <span className="text-sm tabular-nums text-zinc-400">{baselineVal}</span>
              </div>
            )}
            {deltaPct && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">delta</span>
                <span className="text-sm tabular-nums text-red-400">{deltaPct}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_380px] gap-4 p-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Root cause */}
          <Section title="Root Cause" icon={AlertTriangle}>
            <p className="text-sm font-medium text-zinc-100">
              {topCause?.label ?? "No dominant root cause identified"}
            </p>
            {confidence !== null && (
              <p className="text-xs text-zinc-500 mt-1">
                Confidence: {renderPct(confidence)}
              </p>
            )}
            {rootCause.recommended_fix?.summary && (
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                {rootCause.recommended_fix.summary}
              </p>
            )}
            {rootCause.recommended_action_reason && (
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                {rootCause.recommended_action_reason}
              </p>
            )}
            {evidenceLines.length > 0 && (
              <ul className="mt-3 space-y-0.5">
                {evidenceLines.map((line) => (
                  <li key={line} className="text-xs text-zinc-600 font-mono">
                    · {line}
                  </li>
                ))}
              </ul>
            )}
            {/* Probability bars */}
            {rootCause.root_cause_probabilities.length > 0 && (
              <div className="mt-4 space-y-2">
                {rootCause.root_cause_probabilities.slice(0, 4).map((rc) => (
                  <div key={rc.label} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-zinc-400 truncate">{rc.label}</span>
                        <span className="text-xs tabular-nums text-zinc-500 shrink-0 ml-2">
                          {renderPct(rc.probability)}
                        </span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500/70 rounded-full"
                          style={{ width: `${rc.probability * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Trace evidence */}
          {(command.trace_compare.failing_trace_summary || command.trace_compare.baseline_trace_summary) && (
            <Section title="Trace Evidence" icon={Activity}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Failing trace",
                    trace: command.trace_compare.failing_trace_summary,
                    accent: "border-red-500/20 bg-red-500/5",
                    labelColor: "text-red-400",
                  },
                  {
                    label: "Baseline trace",
                    trace: command.trace_compare.baseline_trace_summary,
                    accent: "border-zinc-700/60 bg-zinc-800/30",
                    labelColor: "text-zinc-500",
                  },
                ].map(({ label, trace, accent, labelColor }) =>
                  trace ? (
                    <div key={label} className={cn("rounded border px-3 py-2.5", accent)}>
                      <p className={cn("text-[10px] uppercase tracking-wider font-semibold mb-2", labelColor)}>
                        {label}
                      </p>
                      <div className="space-y-1 text-xs text-zinc-500">
                        {trace.latency_ms != null && (
                          <p>
                            <span className="text-zinc-200 tabular-nums">{trace.latency_ms}ms</span>{" "}
                            latency
                          </p>
                        )}
                        {trace.prompt_tokens != null && (
                          <p>
                            <span className="text-zinc-200 tabular-nums">
                              {(trace.prompt_tokens ?? 0) + (trace.completion_tokens ?? 0)}
                            </span>{" "}
                            tokens
                          </p>
                        )}
                        {trace.prompt_version && (
                          <p className="truncate font-mono text-[10px] text-zinc-600">
                            {trace.prompt_version}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
              {command.trace_compare.compare_link && (
                <div className="mt-3">
                  <Link
                    href={`/prompt-diff`}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    View prompt diff →
                  </Link>
                </div>
              )}
            </Section>
          )}

          {/* Resolution impact */}
          {command.resolution_impact && (
            <Section title="Resolution Impact" icon={CheckCircle2}>
              {command.resolution_impact.summary && (
                <p className="text-sm font-medium text-zinc-100">
                  {command.resolution_impact.summary}
                </p>
              )}
              <div className="mt-2 flex items-center gap-4 text-xs">
                {command.resolution_impact.before_value != null && (
                  <div>
                    <span className="text-zinc-600">before </span>
                    <span className="text-zinc-300 tabular-nums">
                      {command.resolution_impact.before_value}
                      {command.resolution_impact.unit ?? ""}
                    </span>
                  </div>
                )}
                {command.resolution_impact.after_value != null && (
                  <div>
                    <span className="text-zinc-600">after </span>
                    <span className="text-emerald-400 tabular-nums">
                      {command.resolution_impact.after_value}
                      {command.resolution_impact.unit ?? ""}
                    </span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Related regressions */}
          {command.related_regressions.length > 0 && (
            <Section title="Related Regressions" icon={GitBranch}>
              <div className="space-y-2">
                {command.related_regressions.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-mono truncate">{r.metric_name}</span>
                    <span className="text-zinc-600 ml-2 shrink-0">
                      {formatRelative(r.detected_at)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent signals */}
          {command.recent_signals.length > 0 && (
            <Section title="Recent Signals" icon={Clock}>
              <div className="space-y-2">
                {command.recent_signals.slice(0, 8).map((s, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <span className="text-zinc-600 tabular-nums shrink-0 mt-0.5">
                      {formatRelative(s.timestamp)}
                    </span>
                    <span className="text-zinc-400">{s.title ?? s.event_type}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Recommended action */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3.5">
            <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider mb-2">
              Recommended action
            </p>
            <p className="text-sm text-zinc-200 leading-relaxed">
              {rootCause.recommended_fix?.summary ?? "No recommendation available."}
            </p>
            {rootCause.recommended_action_reason && (
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                {rootCause.recommended_action_reason}
              </p>
            )}
          </div>

          {/* Mitigations */}
          {command.recommended_mitigations.length > 0 && (
            <Section title="Mitigations" icon={Zap}>
              <ul className="space-y-1.5">
                {command.recommended_mitigations.slice(0, 5).map((m) => (
                  <li key={m} className="text-xs text-zinc-400 flex gap-2">
                    <span className="text-zinc-700 shrink-0">·</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Deployment context */}
          <Section title="Deployment Context" icon={GitBranch}>
            {command.deployment_context ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Model</span>
                  <span className="text-zinc-300 font-mono truncate ml-2">
                    {command.deployment_context.model_version?.model_name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Prompt version</span>
                  <span className="text-zinc-300 font-mono truncate ml-2">
                    {command.deployment_context.prompt_version?.version ?? "—"}
                  </span>
                </div>
                {command.deployment_context.time_since_deployment_minutes != null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Time to incident</span>
                    <span className="text-zinc-300 tabular-nums">
                      {command.deployment_context.time_since_deployment_minutes}m
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No deployment linked to this incident.</p>
            )}
          </Section>

          {/* Guardrail activity */}
          {command.guardrail_activity.length > 0 && (
            <Section title="Guardrail Activity" icon={Shield}>
              <div className="space-y-2">
                {command.guardrail_activity.slice(0, 5).map((g) => (
                  <div key={g.policy_type} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-mono truncate">{g.policy_type}</span>
                    <span className="text-zinc-600 tabular-nums ml-2 shrink-0">
                      {g.trigger_count} triggers
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Incident timeline */}
          <Section title="Timeline" icon={Clock}>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-600">Started</span>
                <span className="text-zinc-400 tabular-nums">{formatTime(incident.started_at)}</span>
              </div>
              {incident.acknowledged_at && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Acknowledged</span>
                  <span className="text-zinc-400 tabular-nums">{formatTime(incident.acknowledged_at)}</span>
                </div>
              )}
              {incident.acknowledged_by_operator_email && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">By</span>
                  <span className="text-zinc-400 truncate ml-2">
                    {incident.acknowledged_by_operator_email.split("@")[0]}
                  </span>
                </div>
              )}
              {incident.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Resolved</span>
                  <span className="text-emerald-400 tabular-nums">{formatTime(incident.resolved_at)}</span>
                </div>
              )}
              {incident.owner_operator_email && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Owner</span>
                  <span className="text-zinc-400 truncate ml-2">
                    {incident.owner_operator_email.split("@")[0]}
                  </span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
