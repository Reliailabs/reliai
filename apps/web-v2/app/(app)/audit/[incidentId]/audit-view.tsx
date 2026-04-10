"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, CheckCircle, AlertTriangle, User, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

export type AuditEventRow = {
  id: string
  eventType: string
  operatorEmail: string | null
  timestamp: string
  metadata: Record<string, unknown> | null
}

const eventConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  acknowledged: { label: "Acknowledged", color: "text-blue-400",    icon: CheckCircle   },
  resolved:     { label: "Resolved",     color: "text-emerald-400", icon: CheckCircle   },
  owner_assigned: { label: "Owner Assigned", color: "text-violet-400", icon: User },
  owner_cleared: { label: "Owner Cleared", color: "text-zinc-400", icon: User },
  alert_sent:   { label: "Alert Sent",   color: "text-orange-400", icon: AlertTriangle },
  alert_failed: { label: "Alert Failed", color: "text-red-400",    icon: AlertTriangle },
  opened:       { label: "Opened",       color: "text-zinc-400",   icon: Clock },
  updated:      { label: "Updated",      color: "text-zinc-400",   icon: Clock },
  reopened:     { label: "Reopened",     color: "text-amber-400",  icon: Clock },
  config_applied: { label: "Config Applied", color: "text-sky-400", icon: Clock },
  config_undone: { label: "Config Undone", color: "text-zinc-500", icon: Clock },
}

export function AuditView({ events }: { events: AuditEventRow[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    const next = new Set(expandedRows)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedRows(next)
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Audit Log"
        description="Incident-scoped activity and change history"
        right={
          <span className="text-xs text-zinc-500 tabular-nums">
            <span className="text-zinc-200 font-medium">{events.length}</span> events
          </span>
        }
      />

      <div className="divide-y divide-zinc-800/60">
        {events.map((event) => {
          const isExpanded = expandedRows.has(event.id)
          const config = eventConfig[event.eventType] ?? {
            label: event.eventType,
            color: "text-zinc-400",
            icon: Clock,
          }
          const Icon = config.icon

          return (
            <div key={event.id} className="bg-zinc-950/50">
              <div
                className="px-6 py-4 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                onClick={() => toggle(event.id)}
              >
                <div className="flex items-center gap-4">
                  <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <Icon className={cn("w-5 h-5", config.color)} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-medium text-zinc-200 truncate">
                        {config.label}
                      </h4>
                      <span className="text-xs text-zinc-600">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 truncate">
                      {event.operatorEmail ?? "system"}
                    </p>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-4 border-t border-zinc-800/50">
                  <div className="pt-4 text-xs text-zinc-400">
                    {event.metadata ? (
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    ) : (
                      "No additional metadata."
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
