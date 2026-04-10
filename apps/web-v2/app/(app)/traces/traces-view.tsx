"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
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

const initialFilters: FilterOption[] = [
  { key: "env", label: "Env", value: "production" },
]

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

export function TracesView({ traces }: { traces: TraceRowData[] }) {
  const [filters] = useState<FilterOption[]>(initialFilters)

  const showProd = filters.some((f) => f.key === "env" && f.value === "production")
  const visible = showProd
    ? traces.filter((t) => t.environment === "production")
    : traces

  const failed  = visible.filter((t) => t.status === "failed").length
  const refusal = visible.filter((t) => t.status === "refusal").length

  return (
    <div className="min-h-full">
      <PageHeader
        title="Traces"
        description="All ingested AI request traces, filterable by model, prompt, and status."
        right={
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-zinc-200 font-medium">{visible.length.toLocaleString()}</span> traces
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

      <FilterChips initial={initialFilters} />

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
        {visible.map((trace) => (
          <TraceRow key={trace.id} trace={trace} />
        ))}
      </div>

      {visible.length === 0 && (
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
