"use client"

import { useState } from "react"
import type { TraceGraphAnalysisRead, TraceGraphRead, TraceSummaryRead, TraceComparisonRead, TraceReplayRead } from "@reliai/types"
import { TabBar } from "@/components/ui/tab-bar"
import { TraceDetailView, type TraceDetailData } from "./trace-detail-view"
import { TraceGraphView } from "./trace-graph-view"
import { TraceAnalysisPanel } from "./trace-analysis-panel"

export type { TraceDetailData }

type Tab = "detail" | "graph" | "analysis"

interface TraceDetailTabsProps {
  trace: TraceDetailData
  graph: TraceGraphRead | null
  analysis: TraceGraphAnalysisRead | null
  summary?: TraceSummaryRead | null
  compare?: TraceComparisonRead | null
  replay?: TraceReplayRead | null
}

export function TraceDetailTabs({ trace, graph, analysis, summary, compare, replay }: TraceDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("detail")
  const hasGraph = graph !== null

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "detail", label: "Detail" },
    { key: "graph", label: "Execution graph", disabled: !hasGraph },
    { key: "analysis", label: "Analysis" },
  ]

  return (
    <div className="min-h-full">
      <TabBar
        items={tabs}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as Tab)}
      />

      {activeTab === "detail" && <TraceDetailView trace={trace} />}
      {activeTab === "graph" && hasGraph && (
        <div className="p-6">
          <TraceGraphView graph={graph} analysis={analysis} />
        </div>
      )}
      {activeTab === "analysis" && (
        <TraceAnalysisPanel summary={summary ?? null} compare={compare ?? null} replay={replay ?? null} />
      )}
    </div>
  )
}
