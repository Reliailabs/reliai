"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, CheckCircle, AlertTriangle, User, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

interface AuditEvent {
  id: string
  incidentId: string
  incidentTitle: string
  project: string
  eventType: "acknowledged" | "resolved" | "assigned" | "commented" | "escalated"
  operator: string
  operatorEmail: string
  timestamp: string
  details: {
    previousValue?: string
    newValue?: string
    comment?: string
  }
}

const auditEvents: AuditEvent[] = [
  {
    id: "evt1",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "acknowledged",
    operator: "Sarah Chen",
    operatorEmail: "sarah.chen@reliai.io",
    timestamp: "2024-01-15T14:32:00Z",
    details: {},
  },
  {
    id: "evt2",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "assigned",
    operator: "Marcus Johnson",
    operatorEmail: "marcus.johnson@reliai.io",
    timestamp: "2024-01-15T14:45:00Z",
    details: { previousValue: "Unassigned", newValue: "Marcus Johnson" },
  },
  {
    id: "evt3",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "commented",
    operator: "Marcus Johnson",
    operatorEmail: "marcus.johnson@reliai.io",
    timestamp: "2024-01-15T15:20:00Z",
    details: {
      comment: "Investigating model drift. Token distribution has changed significantly. Rolling back to previous version.",
    },
  },
  {
    id: "evt4",
    incidentId: "inc124",
    incidentTitle: "API Latency Spike",
    project: "sentiment-analyzer",
    eventType: "acknowledged",
    operator: "Elena Rodriguez",
    operatorEmail: "elena.rodriguez@reliai.io",
    timestamp: "2024-01-15T13:15:00Z",
    details: {},
  },
  {
    id: "evt5",
    incidentId: "inc124",
    incidentTitle: "API Latency Spike",
    project: "sentiment-analyzer",
    eventType: "escalated",
    operator: "Elena Rodriguez",
    operatorEmail: "elena.rodriguez@reliai.io",
    timestamp: "2024-01-15T13:45:00Z",
    details: { previousValue: "P3", newValue: "P1" },
  },
  {
    id: "evt6",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "resolved",
    operator: "Marcus Johnson",
    operatorEmail: "marcus.johnson@reliai.io",
    timestamp: "2024-01-15T16:10:00Z",
    details: {
      comment: "Rolled back to v0.9.2. Error rate returned to baseline. All tests passing.",
    },
  },
  {
    id: "evt7",
    incidentId: "inc125",
    incidentTitle: "Cost Budget Exceeded",
    project: "data-processor",
    eventType: "acknowledged",
    operator: "James Park",
    operatorEmail: "james.park@reliai.io",
    timestamp: "2024-01-15T12:00:00Z",
    details: {},
  },
]

type EventType = AuditEvent["eventType"]

const eventConfig: Record<EventType, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  acknowledged: { label: "Acknowledged", color: "text-blue-400",    icon: CheckCircle   },
  resolved:     { label: "Resolved",     color: "text-emerald-400", icon: CheckCircle   },
  assigned:     { label: "Assigned",     color: "text-violet-400",  icon: User          },
  commented:    { label: "Comment",      color: "text-zinc-400",    icon: Clock         },
  escalated:    { label: "Escalated",    color: "text-orange-400",  icon: AlertTriangle },
}

const allProjects = ["all", ...new Set(auditEvents.map((e) => e.project))] as string[]

export default function AuditLogPage() {
  const [expandedRows,     setExpandedRows]     = useState<Set<string>>(new Set())
  const [selectedProject, setSelectedProject]   = useState<string>("all")

  const toggle = (id: string) => {
    const next = new Set(expandedRows)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedRows(next)
  }

  const visible = [...(selectedProject === "all"
    ? auditEvents
    : auditEvents.filter((e) => e.project === selectedProject)
  )].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="min-h-full">
      <PageHeader
        title="Audit Log"
        description="Track all incident operations and changes across projects"
        right={
          <span className="text-xs text-zinc-500 tabular-nums">
            <span className="text-zinc-200 font-medium">{visible.length}</span> events
          </span>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-zinc-800/60">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0">
          Project
        </span>
        <div className="flex gap-1">
          {allProjects.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedProject(p)}
              className={cn(
                "px-2 py-0.5 text-xs rounded border transition-colors font-medium",
                selectedProject === p
                  ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                  : "bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
              )}
            >
              {p === "all" ? "All Projects" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm">
        <div className="w-5 shrink-0" />
        <div className="w-5 shrink-0" />
        <div className="flex-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
          Incident
        </div>
        <div className="w-28 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0">
          Event
        </div>
        <div className="w-36 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider shrink-0 hidden lg:block">
          Operator
        </div>
        <div className="w-32 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-right shrink-0">
          Time
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-800/40">
        {visible.map((event) => {
          const isExpanded = expandedRows.has(event.id)
          const cfg        = eventConfig[event.eventType]
          const EventIcon  = cfg.icon
          const hasDetails = event.details.comment || event.details.previousValue

          return (
            <div key={event.id}>
              <div
                className={cn(
                  "flex items-center gap-4 px-6 py-3 transition-colors",
                  hasDetails ? "cursor-pointer hover:bg-zinc-900/50" : "hover:bg-zinc-900/30"
                )}
                onClick={() => hasDetails && toggle(event.id)}
              >
                {/* Expand chevron */}
                <div className="w-5 shrink-0 flex items-center">
                  {hasDetails ? (
                    isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                      : <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                  ) : (
                    <div className="w-3.5" />
                  )}
                </div>

                {/* Event icon */}
                <div className="w-5 shrink-0">
                  <EventIcon className={cn("w-3.5 h-3.5", cfg.color)} />
                </div>

                {/* Incident title */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{event.incidentTitle}</div>
                  <div className="text-xs font-mono text-zinc-700 mt-0.5">{event.incidentId}</div>
                </div>

                {/* Event type badge */}
                <div className="w-28 shrink-0">
                  <span className={cn("text-xs font-medium", cfg.color)}>
                    {cfg.label}
                  </span>
                </div>

                {/* Operator */}
                <div className="w-36 shrink-0 hidden lg:block">
                  <span className="text-xs text-zinc-500 truncate block">{event.operator}</span>
                </div>

                {/* Timestamp */}
                <div className="w-32 shrink-0 text-right">
                  <div className="text-xs text-zinc-500 tabular-nums">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-zinc-700 tabular-nums">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && hasDetails && (
                <div className="px-6 pb-3 ml-14 space-y-2 border-t border-zinc-800/40 pt-3 bg-zinc-900/20">
                  {event.details.previousValue && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-600">Changed:</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono">
                        {event.details.previousValue}
                      </span>
                      <span className="text-zinc-700">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                        {event.details.newValue}
                      </span>
                    </div>
                  )}
                  {event.details.comment && (
                    <div className="text-xs text-zinc-400 bg-zinc-800/40 border border-zinc-800 rounded px-3 py-2 leading-relaxed">
                      {event.details.comment}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
