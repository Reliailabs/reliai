"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { ProviderHealthOverlay, type ProviderStatus } from "@/components/provider-health-overlay"

export type IncidentRowData = {
  id: string
  title: string
  status: "open" | "resolved"
  severity: "critical" | "high" | "medium" | "low"
  project: string
  metric: string
  age: string
  owner?: string | null
  acknowledged?: boolean
}

const severityBg: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-500",
  medium:   "bg-yellow-500",
  low:      "bg-blue-500",
  resolved: "bg-emerald-500",
}

const colWidths = {
  sev:     "w-0.5 shrink-0",
  title:   "flex-1 min-w-0",
  project: "w-36 shrink-0",
  metric:  "w-44 shrink-0 hidden xl:block",
  owner:   "w-32 shrink-0 hidden lg:block",
  age:     "w-12 shrink-0 text-right",
  chevron: "w-5 shrink-0",
}

export function IncidentsView({
  incidents,
  projects,
  filters,
}: {
  incidents: IncidentRowData[]
  projects: Array<{ id: string; name: string }>
  filters: {
    status: string
    severity: string
    projectId: string
    environment: string
    limit: number
  }
}) {
  const router = useRouter()

  const open = incidents.filter((i) => i.status !== "resolved").length
  const resolved = incidents.filter((i) => i.status === "resolved").length

  const activeFilters = useMemo<FilterOption[]>(() => {
    const items: FilterOption[] = []
    if (filters.status) items.push({ key: "status", label: "Status", value: filters.status })
    if (filters.severity) items.push({ key: "severity", label: "Severity", value: filters.severity })
    if (filters.projectId) {
      const project = projects.find((p) => p.id === filters.projectId)
      items.push({ key: "project_id", label: "Project", value: project?.name ?? filters.projectId })
    }
    if (filters.environment) items.push({ key: "environment", label: "Env", value: filters.environment })
    return items
  }, [filters, projects])

  const pushParams = (next: Partial<typeof filters>) => {
    const params = new URLSearchParams()
    const merged = { ...filters, ...next }
    if (merged.status) params.set("status", merged.status)
    if (merged.severity) params.set("severity", merged.severity)
    if (merged.projectId) params.set("project_id", merged.projectId)
    if (merged.environment) params.set("environment", merged.environment)
    if (merged.limit) params.set("limit", String(merged.limit))
    const query = params.toString()
    router.push(`/incidents${query ? `?${query}` : ""}`)
  }

  const providers = [
    {
      provider: "Anthropic Claude API",
      status: "operational" as ProviderStatus,
      description: "All systems nominal",
      lastUpdated: new Date().toISOString(),
      incidentsCount: 0,
    },
    {
      provider: "OpenAI API",
      status: "degraded" as ProviderStatus,
      description: "Higher than normal latencies detected",
      lastUpdated: new Date().toISOString(),
      incidentsCount: 1,
    },
  ]

  return (
    <div className="min-h-full">
      <ProviderHealthOverlay providers={providers} />
      <PageHeader
        title="Incidents"
        description="Detected reliability events, ordered by severity."
        right={
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-red-400 font-medium">{open}</span> open
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-emerald-400 font-medium">{resolved}</span> resolved
            </span>
          </>
        }
      />

      <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-zinc-800/60">
        <select
          value={filters.status}
          onChange={(e) => pushParams({ status: e.target.value })}
          className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
        >
          <option value="">Status: any</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => pushParams({ severity: e.target.value })}
          className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
        >
          <option value="">Severity: any</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filters.environment}
          onChange={(e) => pushParams({ environment: e.target.value })}
          className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
        >
          <option value="">Env: any</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
        </select>
        <select
          value={filters.projectId}
          onChange={(e) => pushParams({ projectId: e.target.value })}
          className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
        >
          <option value="">Project: all</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Limit</span>
          <select
            value={filters.limit}
            onChange={(e) => pushParams({ limit: Number(e.target.value) })}
            className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
          >
            {[25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FilterChips
        filters={activeFilters}
        onRemove={(key) => {
          if (key === "status") pushParams({ status: "" })
          if (key === "severity") pushParams({ severity: "" })
          if (key === "project_id") pushParams({ projectId: "" })
          if (key === "environment") pushParams({ environment: "" })
        }}
        onClear={() => pushParams({ status: "", severity: "", projectId: "", environment: "" })}
      />

      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm">
        <div className={colWidths.sev} />
        <div className="w-4 shrink-0" />
        <div className={`${colWidths.title} text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`}>
          Incident
        </div>
        <div className={`${colWidths.project} text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`}>
          Project
        </div>
        <div className={`${colWidths.metric} text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`}>
          Metric
        </div>
        <div className={`${colWidths.owner} text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`}>
          Owner
        </div>
        <div className={`${colWidths.age} text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`}>
          Age
        </div>
        <div className={colWidths.chevron} />
      </div>

      <div className="divide-y divide-zinc-800/50">
        {incidents.map((inc) => (
          <IncidentRow key={inc.id} incident={inc} />
        ))}
      </div>

      {incidents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
            <span className="text-zinc-500 text-lg">✓</span>
          </div>
          <div className="text-sm font-medium text-zinc-400">No incidents match filters</div>
          <div className="text-xs text-zinc-600 mt-1">Try clearing the active filters</div>
        </div>
      )}
    </div>
  )
}

function IncidentRow({ incident: inc }: { incident: IncidentRowData }) {
  const isResolved = inc.status === "resolved"

  return (
    <Link
      href={`/incidents/${inc.id}`}
      className="group flex items-stretch hover:bg-zinc-900/50 transition-colors"
    >
      <div
        className={`${severityBg[isResolved ? "resolved" : inc.severity]} shrink-0`}
        style={{ width: "2px" }}
      />

      <div className="flex flex-1 items-center gap-4 px-6 py-3.5">
        <div className="w-16 shrink-0">
          <SeverityBadge severity={isResolved ? "resolved" : inc.severity} />
        </div>

        <div className={colWidths.title}>
          <div
            className={`text-sm font-medium truncate ${
              isResolved ? "text-zinc-500" : "text-zinc-100"
            }`}
          >
            {inc.title}
          </div>
          {inc.acknowledged && (
            <span className="text-[10px] text-zinc-500 border border-zinc-700/60 rounded px-1 py-0.5 mt-0.5 inline-block tracking-wide">
              acknowledged
            </span>
          )}
        </div>

        <div className={colWidths.project}>
          <span className="text-xs text-zinc-500 truncate block">{inc.project}</span>
        </div>

        <div className={colWidths.metric}>
          <span className="text-xs font-mono text-zinc-600 truncate block">{inc.metric}</span>
        </div>

        <div className={colWidths.owner}>
          {inc.owner ? (
            <span className="text-xs text-zinc-500 truncate block">
              {inc.owner.split("@")[0]}
            </span>
          ) : (
            <span className="text-xs text-zinc-700">—</span>
          )}
        </div>

        <div className={colWidths.age}>
          <span className="text-xs text-zinc-600 tabular-nums">{inc.age}</span>
        </div>

        <div className={colWidths.chevron}>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
