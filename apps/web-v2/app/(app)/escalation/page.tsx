"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Mail, MessageSquare, Phone, Webhook, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type EscalationChannel = "slack" | "email" | "pagerduty" | "webhook"
type TriggerSeverity   = "critical" | "high" | "all"

interface EscalationStep {
  step: number
  delay: number        // minutes after previous step (0 = immediate)
  action: "notify" | "escalate" | "page"
  target: string
  channel: EscalationChannel
}

interface EscalationPolicy {
  id: string
  name: string
  description: string
  trigger: {
    severity: TriggerSeverity
    unacknowledgedAfter: number  // minutes; 0 = immediately
  }
  steps: EscalationStep[]
  activeIncidents: number
  enabled: boolean
}

// ── Mock data ────────────────────────────────────────────────────────────────

const policies: EscalationPolicy[] = [
  {
    id: "pol-001",
    name: "Critical Incident Response",
    description: "Immediate paging for critical severity incidents",
    trigger: { severity: "critical", unacknowledgedAfter: 0 },
    steps: [
      { step: 1, delay: 0,  action: "notify",   target: "#ops-incidents",   channel: "slack"     },
      { step: 2, delay: 10, action: "page",      target: "On-call Engineer", channel: "pagerduty" },
      { step: 3, delay: 20, action: "escalate",  target: "eng-lead@acme.io", channel: "email"     },
    ],
    activeIncidents: 2,
    enabled: true,
  },
  {
    id: "pol-002",
    name: "High Severity Fallback",
    description: "Escalate high-severity incidents if left unacknowledged",
    trigger: { severity: "high", unacknowledgedAfter: 15 },
    steps: [
      { step: 1, delay: 0,  action: "notify",  target: "#incidents",        channel: "slack" },
      { step: 2, delay: 20, action: "notify",  target: "team@acme.io",      channel: "email" },
      { step: 3, delay: 40, action: "page",    target: "On-call Engineer",  channel: "pagerduty" },
    ],
    activeIncidents: 3,
    enabled: true,
  },
  {
    id: "pol-003",
    name: "After-Hours Emergency",
    description: "All-severity escalation path for off-hours incidents",
    trigger: { severity: "all", unacknowledgedAfter: 5 },
    steps: [
      { step: 1, delay: 0,  action: "page",     target: "PagerDuty On-Call", channel: "pagerduty" },
      { step: 2, delay: 10, action: "notify",   target: "#emergency",        channel: "slack"     },
      { step: 3, delay: 20, action: "escalate", target: "Incident Commander", channel: "webhook"  },
    ],
    activeIncidents: 0,
    enabled: false,
  },
  {
    id: "pol-004",
    name: "Cost Overrun Alerts",
    description: "Notify finance and engineering when budget thresholds are exceeded",
    trigger: { severity: "high", unacknowledgedAfter: 30 },
    steps: [
      { step: 1, delay: 0,  action: "notify",  target: "finance@acme.io",  channel: "email" },
      { step: 2, delay: 30, action: "notify",  target: "#cost-alerts",     channel: "slack" },
    ],
    activeIncidents: 1,
    enabled: true,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const severityBar: Record<TriggerSeverity, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-500",
  all:      "bg-zinc-500",
}

const severityBadge: Record<TriggerSeverity, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high:     "text-amber-400 bg-amber-500/10 border-amber-500/20",
  all:      "text-zinc-400 bg-zinc-700/30 border-zinc-700",
}

const channelIcon: Record<EscalationChannel, React.ComponentType<{ className?: string }>> = {
  slack:     MessageSquare,
  email:     Mail,
  pagerduty: Phone,
  webhook:   Webhook,
}

const channelColor: Record<EscalationChannel, string> = {
  slack:     "text-violet-400",
  email:     "text-blue-400",
  pagerduty: "text-emerald-400",
  webhook:   "text-zinc-400",
}

const actionLabel: Record<EscalationStep["action"], string> = {
  notify:   "Notify",
  escalate: "Escalate",
  page:     "Page",
}

// ── Step timeline ─────────────────────────────────────────────────────────────

function StepTimeline({ steps }: { steps: EscalationStep[] }) {
  return (
    <div className="flex items-start gap-0 ml-14 mr-6 pb-4 pt-3 border-t border-zinc-800/40 bg-zinc-900/20">
      {steps.map((s, i) => {
        const ChannelIcon = channelIcon[s.channel]
        const isLast      = i === steps.length - 1
        return (
          <div key={s.step} className="flex items-start flex-1">
            {/* Step bubble + connector */}
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">
                {s.step}
              </div>
              {!isLast && <div className="w-px flex-1 bg-zinc-800 mt-1 min-h-[20px]" />}
            </div>

            {/* Step detail */}
            <div className="ml-3 flex-1 min-w-0 pb-4 pr-4">
              {/* Delay label */}
              {s.delay === 0 ? (
                <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  Immediately
                </span>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                  <Clock className="w-2.5 h-2.5" />
                  <span>After {s.delay}m</span>
                </div>
              )}

              {/* Action */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-medium text-zinc-300">{actionLabel[s.action]}</span>
                <ChannelIcon className={cn("w-3 h-3", channelColor[s.channel])} />
              </div>

              {/* Target */}
              <div className="text-xs text-zinc-500 mt-0.5 truncate">{s.target}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EscalationPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["pol-001"]))

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpanded(next)
  }

  const enabled  = policies.filter((p) => p.enabled).length
  const active   = policies.reduce((n, p) => n + p.activeIncidents, 0)

  return (
    <div className="min-h-full">
      <PageHeader
        title="Escalation Policies"
        description="Define who gets paged and when for unacknowledged incidents."
        right={
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-zinc-200 font-medium">{enabled}</span> active
            </span>
            {active > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-red-400 tabular-nums">{active} incidents routing</span>
              </>
            )}
          </>
        }
      />

      {/* Table header */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm">
        <div className="w-0.5 shrink-0" />
        <div className="w-5 shrink-0" />
        <div className="flex-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
          Policy
        </div>
        <div className="w-24 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0">
          Trigger
        </div>
        <div className="w-20 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0 hidden md:block">
          Steps
        </div>
        <div className="w-24 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">
          Incidents
        </div>
        <div className="w-16 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">
          Status
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-800/40">
        {policies.map((policy) => {
          const isExpanded = expanded.has(policy.id)

          return (
            <div key={policy.id}>
              {/* Row */}
              <div
                className="group flex items-stretch cursor-pointer hover:bg-zinc-900/50 transition-colors"
                onClick={() => toggle(policy.id)}
              >
                {/* Severity left bar */}
                <div
                  className={cn("shrink-0", severityBar[policy.trigger.severity])}
                  style={{ width: "2px" }}
                />

                <div className="flex flex-1 items-center gap-4 px-6 py-3.5">
                  {/* Expand chevron */}
                  <div className="w-5 shrink-0">
                    {isExpanded
                      ? <ChevronDown  className="w-3.5 h-3.5 text-zinc-500" />
                      : <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    }
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        policy.enabled ? "text-zinc-100" : "text-zinc-500"
                      )}>
                        {policy.name}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5 truncate">{policy.description}</div>
                  </div>

                  {/* Trigger */}
                  <div className="w-24 shrink-0">
                    <span className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
                      severityBadge[policy.trigger.severity]
                    )}>
                      {policy.trigger.severity}
                    </span>
                    {policy.trigger.unacknowledgedAfter > 0 && (
                      <div className="text-[10px] text-zinc-700 mt-0.5 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {policy.trigger.unacknowledgedAfter}m
                      </div>
                    )}
                  </div>

                  {/* Step count */}
                  <div className="w-20 shrink-0 hidden md:block">
                    <span className="text-xs text-zinc-400 tabular-nums">{policy.steps.length} steps</span>
                  </div>

                  {/* Active incidents */}
                  <div className="w-24 shrink-0 text-right">
                    {policy.activeIncidents > 0 ? (
                      <span className="text-xs text-red-400 tabular-nums font-medium">
                        {policy.activeIncidents} routing
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Enabled toggle (display only) */}
                  <div className="w-16 shrink-0 flex justify-end">
                    <div className={cn(
                      "w-7 h-4 rounded-full relative transition-colors",
                      policy.enabled ? "bg-emerald-500/30" : "bg-zinc-700"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-3 h-3 rounded-full transition-all",
                        policy.enabled
                          ? "left-[14px] bg-emerald-400"
                          : "left-0.5 bg-zinc-500"
                      )} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded step timeline */}
              {isExpanded && <StepTimeline steps={policy.steps} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
