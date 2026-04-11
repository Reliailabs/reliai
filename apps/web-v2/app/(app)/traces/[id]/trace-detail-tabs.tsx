"use client"

import { useState } from "react"
import type { TraceGraphAnalysisRead, TraceGraphRead } from "@reliai/types"
import { cn } from "@/lib/utils"
import { TraceDetailView, type TraceDetailData } from "./trace-detail-view"
import { TraceGraphView } from "./trace-graph-view"

export type { TraceDetailData }

type Tab = "detail" | "graph"

interface TraceDetailTabsProps {
  trace: TraceDetailData
  graph: TraceGraphRead | null
  analysis: TraceGraphAnalysisRead | null
}

export function TraceDetailTabs({ trace, graph, analysis }: TraceDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("detail")
  const hasGraph = graph !== null

  return (
    <div className="min-h-full">
      {/* ── Tab bar ── */}
      <div className="border-b border-zinc-800 px-6">
        <div className="-mb-px flex gap-0">
          <TabButton active={activeTab === "detail"} onClick={() => setActiveTab("detail")}>
            Detail
          </TabButton>
          <TabButton
            active={activeTab === "graph"}
            onClick={() => setActiveTab("graph")}
            disabled={!hasGraph}
          >
            Execution graph
            {!hasGraph && <span className="ml-1.5 text-zinc-700">—</span>}
          </TabButton>
        </div>
      </div>

      {/* ── Tab panels ── */}
      {activeTab === "detail" && <TraceDetailView trace={trace} />}
      {activeTab === "graph" && hasGraph && (
        <div className="p-6">
          <TraceGraphView graph={graph} analysis={analysis} />
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-zinc-300 text-zinc-100"
          : "border-transparent text-zinc-600 hover:text-zinc-400",
        disabled && "cursor-default opacity-40 hover:text-zinc-600"
      )}
    >
      {children}
    </button>
  )
}
