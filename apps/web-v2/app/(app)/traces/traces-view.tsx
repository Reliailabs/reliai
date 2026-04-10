"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips"
import { cn } from "@/lib/utils"

export type TraceRowData = {
  id: string
  requestId: string
  status: "success" | "failed" | "refusal"
  model: string
  promptVersion: string
  latency: string
  tokens: string
  environment: "production" | "staging"
  age: string
}

const statusDot: Record<TraceRowData["status"], string> = {
  success: "bg-emerald-500",
  failed:  "bg-red-500",
  refusal: "bg-amber-500",
}

const statusLabel: Record<TraceRowData["status"], string> = {
  success: "text-emerald-400",
  failed:  "text-red-400",
  refusal: "text-amber-400",
}

export function TracesView({
  traces,
  nextCursor,
  projects,
  filters,
}: {
  traces: TraceRowData[]
  nextCursor: string | null
  projects: Array<{ id: string; name: string }>
  filters: {
    environment: string
    success: string
    projectId: string
    cursor: string
  }
}) {
  const router = useRouter()

  const failed  = traces.filter((t) => t.status === "failed").length
  const refusal = traces.filter((t) => t.status === "refusal").length

  const activeFilters = useMemo<FilterOption[]>(() => {
    const items: FilterOption[] = []
    if (filters.environment) items.push({ key: "environment", label: "Env", value: filters.environment })
    if (filters.success) {
      items.push({
        key: "success",
        label: "Status",
        value: filters.success === "true" ? "success" : "failed",
      })
    }
    if (filters.projectId) {
      const project = projects.find((p) => p.id === filters.projectId)
      items.push({ key: "project_id", label: "Project", value: project?.name ?? filters.projectId })
    }
    return items
  }, [filters, projects])

  const pushParams = (next: Partial<typeof filters> & { cursor?: string }) => {
    const params = new URLSearchParams()
    const merged = { ...filters, ...next }
    if (merged.environment) params.set("environment", merged.environment)
    if (merged.success) params.set("success", merged.success)
    if (merged.projectId) params.set("project_id", merged.projectId)
    if (merged.cursor) params.set("cursor", merged.cursor)
    const query = params.toString()
    router.push(`/traces${query ? `?${query}` : ""}`)
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Traces"
        description="All ingested AI request traces, filterable by model, prompt, and status."
        right={
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-zinc-200 font-medium">{traces.length.toLocaleString()}</span> traces
            </span>
            {failed > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-red-400 tabular-nums">{failed} failed</span>
              </>
            )}
            {refusal > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-amber-400 tabular-nums">{refusal} refusal</span>
              </>
            )}
          </>
        }
      />

      <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-zinc-800/60">
        <select
          value={filters.environment}
          onChange={(e) => pushParams({ environment: e.target.value, cursor: "" })}
          className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
        >
          <option value="">Env: any</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
        </select>
        <select
          value={filters.success}
          onChange={(e) => pushParams({ success: e.target.value, cursor: "" })}
          className="text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
        >
          <option value="">Status: any</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
        <select
          value={filters.projectId}
          onChange={(e) => pushParams({ projectId: e.target.value, cursor: "" })}
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
          {nextCursor && (
            <button
              onClick={() => pushParams({ cursor: nextCursor })}
              className="text-xs bg-zinc-800 text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
            >
              Next
            </button>
          )}
          {filters.cursor && (
            <button
              onClick={() => pushParams({ cursor: "" })}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <FilterChips
        filters={activeFilters}
        onRemove={(key) => {
          if (key === "environment") pushParams({ environment: "", cursor: "" })
          if (key === "success") pushParams({ success: "", cursor: "" })
          if (key === "project_id") pushParams({ projectId: "", cursor: "" })
        }}
        onClear={() => pushParams({ environment: "", success: "", projectId: "", cursor: "" })}
      />

      <div className="flex items-center gap-0 px-6 py-2.5 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 backdrop-blur-sm text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
        <div className="w-6 shrink-0" />
        <div className="w-28 shrink-0">Request</div>
        <div className="w-44 shrink-0">Model</div>
        <div className="w-24 shrink-0 hidden md:block">Prompt</div>
        <div className="flex-1" />
        <div className="w-16 text-right shrink-0">Latency</div>
        <div className="w-16 text-right shrink-0 hidden sm:block">Tokens</div>
        <div className="w-20 text-right shrink-0 hidden lg:block">Env</div>
        <div className="w-12 text-right shrink-0">Age</div>
        <div className="w-5 shrink-0" />
      </div>

      <div className="divide-y divide-zinc-800/40">
        {traces.map((trace) => (
          <TraceRow key={trace.id} trace={trace} />
        ))}
      </div>

      {traces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-sm text-zinc-500">No traces match filters</div>
        </div>
      )}
    </div>
  )
}

function TraceRow({ trace }: { trace: TraceRowData }) {
  return (
    <Link
      href={`/traces/${trace.id}`}
      className="group flex items-center gap-0 px-6 py-3 hover:bg-zinc-900/50 transition-colors"
    >
      <div className="w-6 shrink-0 flex items-center">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            statusDot[trace.status]
          )}
        />
      </div>

      <div className="w-28 shrink-0">
        <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-300 transition-colors">
          {trace.requestId}
        </span>
      </div>

      <div className="w-44 shrink-0">
        <span className="text-xs text-zinc-300">{trace.model}</span>
      </div>

      <div className="w-24 shrink-0 hidden md:block">
        <span className="text-xs font-mono text-zinc-600">{trace.promptVersion}</span>
      </div>

      <div className="flex-1">
        {trace.status !== "success" && (
          <span className={cn("text-xs font-medium", statusLabel[trace.status])}>
            {trace.status}
          </span>
        )}
      </div>

      <div className="w-16 text-right shrink-0">
        <span
          className={cn(
            "text-xs font-mono tabular-nums",
            parseFloat(trace.latency) > 2 ? "text-amber-400" : "text-zinc-400"
          )}
        >
          {trace.latency}
        </span>
      </div>

      <div className="w-16 text-right shrink-0 hidden sm:block">
        <span className="text-xs font-mono text-zinc-600 tabular-nums">
          {trace.tokens}
        </span>
      </div>

      <div className="w-20 text-right shrink-0 hidden lg:block">
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            trace.environment === "production" ? "text-zinc-600" : "text-violet-500"
          )}
        >
          {trace.environment === "production" ? "prod" : "stg"}
        </span>
      </div>

      <div className="w-12 text-right shrink-0">
        <span className="text-xs text-zinc-700 tabular-nums">{trace.age}</span>
      </div>

      <div className="w-5 shrink-0 flex justify-end">
        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
      </div>
    </Link>
  )
}
