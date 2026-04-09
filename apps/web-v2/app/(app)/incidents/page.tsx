"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips"
import { SeverityBadge } from "@/components/ui/severity-badge"
import { ProviderHealthOverlay, type ProviderStatus } from "@/components/provider-health-overlay"
import { incidents } from "@/lib/mock-data"
import type { Incident } from "@/lib/mock-data"

const initialFilters: FilterOption[] = [
  { key: "status", label: "Status", value: "Open" },
]

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

export default function IncidentsPage() {
  const [filters] = useState<FilterOption[]>(initialFilters)

  const visible = filters.some((f) => f.key === "status" && f.value === "Open")
    ? incidents.filter((i) => i.status !== "resolved")
    : incidents

  const open = incidents.filter((i) => i.status !== "resolved").length
  const resolved = incidents.filter((i) => i.status === "resolved").length

  // Mock provider health data
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

      <FilterChips initial={initialFilters} />

      {/* Table header */}
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

      {/* Rows */}
      <div className="divide-y divide-zinc-800/50">
        {visible.map((inc) => (
          <IncidentRow key={inc.id} incident={inc} />
        ))}
      </div>

      {visible.length === 0 && (
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

function IncidentRow({ incident: inc }: { incident: Incident }) {
  const isResolved = inc.status === "resolved"

  return (
    <Link
      href={`/incidents/${inc.id}`}
      className="group flex items-stretch hover:bg-zinc-900/50 transition-colors"
    >
      {/* Severity left bar */}
      <div
        className={`${severityBg[isResolved ? "resolved" : inc.severity]} shrink-0`}
        style={{ width: "2px" }}
      />

      {/* Row content */}
      <div className="flex flex-1 items-center gap-4 px-6 py-3.5">
        {/* Severity badge */}
        <div className="w-16 shrink-0">
          <SeverityBadge severity={isResolved ? "resolved" : inc.severity} />
        </div>

        {/* Title */}
        <div className={colWidths.title}>
          <div
            className={`text-sm font-medium truncate ${
              isResolved ? "text-zinc-500" : "text-zinc-100"
            }`}
          >
            {inc.title}
          </div>
          {inc.status === "acknowledged" && (
            <span className="text-[10px] text-zinc-500 border border-zinc-700/60 rounded px-1 py-0.5 mt-0.5 inline-block tracking-wide">
              acknowledged
            </span>
          )}
        </div>

        {/* Project */}
        <div className={colWidths.project}>
          <span className="text-xs text-zinc-500 truncate block">{inc.project}</span>
        </div>

        {/* Metric */}
        <div className={colWidths.metric}>
          <span className="text-xs font-mono text-zinc-600 truncate block">{inc.metric}</span>
        </div>

        {/* Owner */}
        <div className={colWidths.owner}>
          {inc.owner ? (
            <span className="text-xs text-zinc-500 truncate block">
              {inc.owner.split("@")[0]}
            </span>
          ) : (
            <span className="text-xs text-zinc-700">—</span>
          )}
        </div>

        {/* Age */}
        <div className={colWidths.age}>
          <span className="text-xs text-zinc-600 tabular-nums">{inc.age}</span>
        </div>

        {/* Chevron */}
        <div className={colWidths.chevron}>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
