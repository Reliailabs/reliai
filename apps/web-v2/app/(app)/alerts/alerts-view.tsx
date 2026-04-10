"use client";

import { useMemo, useState } from "react"
import { ChevronRight, ChevronDown, AlertTriangle, Info, XCircle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/time"

export type AlertTargetData = {
  channel_type: string
  channel_target: string
  is_active: boolean
  webhook_masked: string | null
}

type AlertSeverity = "critical" | "warning" | "info"

export type AlertDeliveryRow = {
  id: string
  incidentId: string
  channelType: string
  channelTarget: string
  deliveryStatus: string
  attemptCount: number
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
}

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

const statusConfig: Record<string, string> = {
  sent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  suppressed: "bg-zinc-700/40 text-zinc-400 border-zinc-700/60",
}

function mapSeverity(status: string): AlertSeverity {
  if (status === "failed") return "critical"
  if (status === "pending") return "warning"
  return "info"
}

export function AlertsView({
  alertTarget,
  deliveries,
}: {
  alertTarget: AlertTargetData | null
  deliveries: AlertDeliveryRow[]
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const now = Date.now()
  const activeCount = useMemo(
    () => deliveries.filter((d) => d.deliveryStatus !== "sent").length,
    [deliveries]
  )

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
                {activeCount} active
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-zinc-800">
          {deliveries.map((delivery) => {
            const isExpanded = expandedRows.has(delivery.id)
            const severity = mapSeverity(delivery.deliveryStatus)
            const SeverityIcon = severityIcon[severity]
            const timestamp = delivery.sentAt ?? delivery.createdAt

            return (
              <div key={delivery.id} className="bg-zinc-950/50">
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                  onClick={() => toggleRow(delivery.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <SeverityIcon className={cn("w-5 h-5", severityColor[severity])} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-medium text-zinc-200 truncate">
                          Incident alert · {delivery.incidentId.slice(0, 8)}
                        </h4>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
                          statusConfig[delivery.deliveryStatus] ?? statusConfig.pending
                        )}>
                          {delivery.deliveryStatus}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 truncate">
                        {delivery.channelType} · {delivery.channelTarget}
                      </p>
                    </div>

                    <div className="text-right text-xs text-zinc-500">
                      <div>{formatRelativeTime(timestamp, now)}</div>
                      <div className="mt-1">{delivery.attemptCount} attempts</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-4 border-t border-zinc-800/50">
                    <div className="pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-zinc-500">Incident ID:</span>
                          <span className="ml-2 text-zinc-300">{delivery.incidentId}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Timestamp:</span>
                          <span className="ml-2 text-zinc-300">
                            {new Date(timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {delivery.errorMessage && (
                        <div className="text-xs text-red-400">
                          Error: {delivery.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {deliveries.length === 0 && (
            <div className="px-6 py-6 text-xs text-zinc-500">
              No alert delivery events found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
