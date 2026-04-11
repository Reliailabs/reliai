import Link from "next/link"
import type { UsageQuotaStatusRead } from "@reliai/types"
import { ChevronRight, Rocket, FileText, Box } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { SeverityBadge } from "@/components/ui/severity-badge"

export type DashboardIncidentRow = {
  id: string
  title: string
  project: string
  metric: string
  severity: "critical" | "high" | "medium" | "low"
  status: string
  age: string
}

export type DashboardChangeRow = {
  id: string
  type: "deployment" | "prompt" | "model"
  label: string
  project: string
  environment: string
  age: string
}

export type DashboardAlertRow = {
  id: string
  status: string
  channel: string
  target: string
  age: string
}

export type WeeklyIncidentPoint = {
  day: string
  count: number
}

const severityBg: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-500",
  medium:   "bg-yellow-500",
  low:      "bg-blue-500",
}

const changeIcon = {
  deployment: <Rocket className="w-3 h-3" />,
  prompt:     <FileText className="w-3 h-3" />,
  model:      <Box className="w-3 h-3" />,
}

const deliveryStatusConfig: Record<string, string> = {
  sent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  suppressed: "bg-zinc-700/40 text-zinc-400 border-zinc-700/60",
}

export function DashboardView({
  openIncidents,
  unacknowledgedCount,
  changes,
  weeklyIncidents,
  avgMttrMinutes,
  usageQuota,
  alertDeliveries,
}: {
  openIncidents: DashboardIncidentRow[]
  unacknowledgedCount: number
  changes: DashboardChangeRow[]
  weeklyIncidents: WeeklyIncidentPoint[]
  avgMttrMinutes: number | null
  usageQuota: UsageQuotaStatusRead | null
  alertDeliveries: DashboardAlertRow[]
}) {
  const maxIncidents = Math.max(0, ...weeklyIncidents.map((d) => d.count))
  const traceUsageUsed = usageQuota?.usage_status?.used ?? null
  const traceUsageLimit =
    usageQuota?.max_traces_per_day ?? usageQuota?.usage_status?.limit ?? null
  const traceUsagePercent =
    usageQuota?.usage_status?.percent_used ??
    (traceUsageUsed !== null && traceUsageLimit ? (traceUsageUsed / traceUsageLimit) * 100 : null)
  const traceUsagePercentClamped = traceUsagePercent
    ? Math.min(100, Math.max(0, traceUsagePercent))
    : 0

  const evalUsageUsed = usageQuota?.usage_status?.projected_usage ?? null
  const evalUsageLimit = usageQuota?.max_api_requests ?? null
  const evalUsagePercent =
    evalUsageUsed !== null && evalUsageLimit
      ? (evalUsageUsed / evalUsageLimit) * 100
      : null
  const evalUsagePercentClamped = evalUsagePercent
    ? Math.min(100, Math.max(0, evalUsagePercent))
    : 0

  return (
    <div className="min-h-full">
      <PageHeader
        title="Triage Console"
        description="Monitor and respond to AI reliability events across your projects."
        right={
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">API healthy</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
              <span className="text-xs font-medium text-red-400">{openIncidents.length} open</span>
            </div>
            {unacknowledgedCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                <span className="text-xs font-medium text-amber-400">
                  {unacknowledgedCount} unacknowledged
                </span>
              </div>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-0 p-6 gap-x-6">
        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Active incidents
              </h2>
              <Link
                href="/incidents"
                className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5 transition-colors"
              >
                View all
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60">
              {openIncidents.slice(0, 5).map((inc) => (
                <Link
                  key={inc.id}
                  href={`/post-mortem/${inc.id}`}
                  className="group flex items-stretch hover:bg-zinc-800/40 transition-colors"
                >
                  <div className={`w-0.5 shrink-0 ${severityBg[inc.severity]}`} />

                  <div className="flex flex-1 items-center gap-4 px-4 py-3.5 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">
                        {inc.title}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 truncate">
                        {inc.project} · {inc.metric}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {inc.status === "acknowledged" && (
                        <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 tracking-wide">
                          ack
                        </span>
                      )}
                      <SeverityBadge severity={inc.severity} />
                      <span className="text-xs text-zinc-600 tabular-nums w-7 text-right">
                        {inc.age}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Recent changes
              </h2>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60">
              {changes.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="text-zinc-600 shrink-0">
                    {changeIcon[ch.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-300 truncate block">
                      {ch.label}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {ch.project} → {ch.environment}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-600 tabular-nums shrink-0">
                    {ch.age}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Investigate
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/traces"
                className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <ScanLineIcon />
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                </div>
                <div className="mt-2.5 text-sm font-medium text-zinc-200">
                  Trace Explorer
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  Browse and filter all request traces
                </div>
              </Link>
              <Link
                href="/incidents"
                className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <ShieldIcon />
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                </div>
                <div className="mt-2.5 text-sm font-medium text-zinc-200">
                  Incident Queue
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  All open and resolved incidents
                </div>
              </Link>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                System state
              </span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <StatusRow label="API status" value="healthy" tone="success" />
              <StatusRow label="Worker queue" value="0 pending" tone="success" />
              <StatusRow
                label="Open incidents"
                value={String(openIncidents.length)}
                tone={openIncidents.length > 0 ? "critical" : "success"}
              />
              <StatusRow
                label="Unacknowledged"
                value={String(unacknowledgedCount)}
                tone={unacknowledgedCount > 0 ? "warning" : "success"}
              />
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Incident rate
              </span>
              <span className="text-[10px] text-zinc-600">7 days</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-end gap-1.5 h-14">
                {weeklyIncidents.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className={`w-full rounded-sm transition-all ${
                        d.count === 0
                          ? "bg-zinc-800"
                          : d.count >= 3
                          ? "bg-red-500/50"
                          : "bg-amber-500/40"
                      }`}
                      style={{
                        height: `${Math.max(4, (d.count / (maxIncidents || 1)) * 44)}px`,
                      }}
                    />
                    <span className="text-[9px] text-zinc-600 leading-none">
                      {d.day[0]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-lg font-semibold text-zinc-100 tabular-nums leading-none">
                    {weeklyIncidents.reduce((sum, d) => sum + d.count, 0)}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">incidents / 7d</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-zinc-100 tabular-nums leading-none">
                    {avgMttrMinutes !== null ? `${avgMttrMinutes}m` : "—"}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">avg MTTR</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Usage
              </span>
            </div>
            <div className="px-4 py-3.5 space-y-4">
              <UsageRow
                label="Traces"
                used={traceUsageUsed}
                limit={traceUsageLimit}
                percent={traceUsagePercent}
                percentClamped={traceUsagePercentClamped}
              />
              <UsageRow
                label="Evaluations"
                used={evalUsageUsed}
                limit={evalUsageLimit}
                percent={evalUsagePercent}
                percentClamped={evalUsagePercentClamped}
              />
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Alert deliveries
              </span>
              <Link
                href="/alerts"
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {alertDeliveries.slice(0, 10).map((delivery) => (
                <div key={delivery.id} className="px-4 py-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-zinc-300 truncate">
                        {delivery.channel} · {delivery.target}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1">
                        {delivery.age}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border ${
                        deliveryStatusConfig[delivery.status] ??
                        "bg-zinc-700/40 text-zinc-400 border-zinc-700/60"
                      }`}
                    >
                      {delivery.status}
                    </span>
                  </div>
                </div>
              ))}
              {alertDeliveries.length === 0 && (
                <div className="px-4 py-3 text-xs text-zinc-500">
                  No alert deliveries yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "success" | "critical" | "warning" | "neutral"
}) {
  const dotColor = {
    success:  "bg-emerald-500",
    critical: "bg-red-500",
    warning:  "bg-amber-500",
    neutral:  "bg-zinc-600",
  }[tone]

  const valueColor = {
    success:  "text-emerald-400",
    critical: "text-red-400",
    warning:  "text-amber-400",
    neutral:  "text-zinc-400",
  }[tone]

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <span className={`text-xs font-medium tabular-nums ${valueColor}`}>
        {value}
      </span>
    </div>
  )
}

function UsageRow({
  label,
  used,
  limit,
  percent,
  percentClamped,
}: {
  label: string
  used: number | null
  limit: number | null
  percent: number | null
  percentClamped: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-zinc-200 tabular-nums">
          {used !== null ? used.toLocaleString() : "—"}
        </span>
        <span className="text-xs text-zinc-600">
          / {limit !== null ? limit.toLocaleString() : "—"} {label.toLowerCase()}
        </span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${percentClamped}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] text-zinc-600">
        {percent !== null ? `${percent.toFixed(1)}%` : "—"} used
      </div>
    </div>
  )
}

function ScanLineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}
