"use client";

import { useState } from "react"
import { ChevronRight, ChevronDown, AlertTriangle, Info, XCircle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

export type AlertTargetData = {
  channel_type: string
  channel_target: string
  is_active: boolean
  webhook_masked: string | null
}

const alerts = [
  {
    id: "a1",
    title: "High Error Rate Detected",
    description: "Error rate exceeded 5% threshold for sentiment-analyzer",
    severity: "critical" as const,
    status: "active" as const,
    project: "sentiment-analyzer",
    timestamp: "2024-01-15T10:30:00Z",
    duration: "2h 15m",
    affected: "23 requests",
  },
  {
    id: "a2",
    title: "Latency SLO Violation",
    description: "P95 latency exceeded 2000ms for 15 minutes",
    severity: "warning" as const,
    status: "active" as const,
    project: "sentiment-analyzer",
    timestamp: "2024-01-15T09:45:00Z",
    duration: "45m",
    affected: "156 requests",
  },
]

type AlertSeverity = "critical" | "warning" | "info"
type AlertStatus = "active" | "acknowledged" | "resolved"

const severityIcon: Record<AlertSeverity, React.ComponentType<{ className?: string }>> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const severityColor: Record<AlertSeverity, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  info: "text-blue-400",
}

const statusConfig: Record<AlertStatus, string> = {
  active: "bg-red-500/10 text-red-400 border-red-500/20",
  acknowledged: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
}

export function AlertsView({ alertTarget }: { alertTarget: AlertTargetData | null }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Monitor and manage system alerts and notifications"
      />

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-medium text-zinc-200">Alert Target</h3>
        </div>
        <div className="px-6 py-4">
          {alertTarget ? (
            <div className="flex items-center justify-between text-xs">
              <div className="text-zinc-300">
                {alertTarget.channel_type} · {alertTarget.channel_target}
              </div>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
                  alertTarget.is_active
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-zinc-700/50 text-zinc-500 border-zinc-700/50"
                )}
              >
                {alertTarget.is_active ? "active" : "disabled"}
              </span>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">No alert target configured.</div>
          )}
        </div>
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-200">Alert Delivery History</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">
                {alerts.filter(a => a.status === "active").length} active
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-zinc-800">
          {alerts.map((alert) => {
            const isExpanded = expandedRows.has(alert.id)
            const SeverityIcon = severityIcon[alert.severity]

            return (
              <div key={alert.id} className="bg-zinc-950/50">
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                  onClick={() => toggleRow(alert.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <SeverityIcon className={cn("w-5 h-5", severityColor[alert.severity])} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-medium text-zinc-200 truncate">
                          {alert.title}
                        </h4>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
                          statusConfig[alert.status]
                        )}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 truncate">
                        {alert.description}
                      </p>
                    </div>

                    <div className="text-right text-xs text-zinc-500">
                      <div>{alert.duration}</div>
                      <div className="mt-1">{alert.affected}</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-4 border-t border-zinc-800/50">
                    <div className="pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-zinc-500">Project:</span>
                          <span className="ml-2 text-zinc-300">{alert.project}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Triggered:</span>
                          <span className="ml-2 text-zinc-300">
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors">
                          Acknowledge
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors">
                          View Details
                        </button>
                        {alert.status === "active" && (
                          <button className="px-3 py-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 rounded transition-colors">
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
