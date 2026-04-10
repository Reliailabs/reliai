"use client"

import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ProviderStatus = "operational" | "degraded" | "partial_outage" | "major_outage"

interface ProviderHealthData {
  provider: string
  status: ProviderStatus
  description: string
  lastUpdated: string
  incidentsCount: number
}

const statusConfig: Record<ProviderStatus, { color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  operational: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    icon: CheckCircle,
  },
  degraded: {
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    icon: AlertTriangle,
  },
  partial_outage: {
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    icon: AlertTriangle,
  },
  major_outage: {
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: AlertCircle,
  },
}

interface ProviderHealthOverlayProps {
  providers: ProviderHealthData[]
}

export function ProviderHealthOverlay({ providers }: ProviderHealthOverlayProps) {
  const hasIssues = providers.some(p => p.status !== "operational")
  if (!hasIssues) return null
  return (
    <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          Provider Status Alert
        </div>
        <div className="grid gap-2">
          {providers.map((provider) => {
            if (provider.status === "operational") return null
            const StatusIcon = statusConfig[provider.status].icon
            return (
              <div
                key={provider.provider}
                className={cn(
                  "flex items-center gap-3 p-3 rounded border text-sm bg-zinc-950/50 border-zinc-800",
                  statusConfig[provider.status].bg
                )}
              >
                <StatusIcon className={cn("w-4 h-4", statusConfig[provider.status].color)} />
                <div className="flex-1">
                  <span className="font-medium">{provider.provider}:</span>
                  <span className="ml-2 text-xs text-zinc-400">{provider.description}</span>
                </div>
                {provider.incidentsCount > 0 && (
                  <span className="text-xs text-zinc-500">
                    {provider.incidentsCount} incident{provider.incidentsCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
