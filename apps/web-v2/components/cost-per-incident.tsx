"use client"

import { DollarSign, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CostMetrics {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  modelName: string
  estimatedCost: number
  costBreakdown: {
    inputCost: number
    outputCost: number
  }
}

interface CostPerIncidentProps {
  metrics: CostMetrics
  className?: string
}

// Standard model token prices (as of 2024)
const modelPrices: Record<string, { input: number; output: number }> = {
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
}

export function CostPerIncident({ metrics, className }: CostPerIncidentProps) {
  const costTrend = metrics.estimatedCost > 0.10 ? "high" : metrics.estimatedCost > 0.05 ? "medium" : "low"
  const costColor = costTrend === "high" ? "text-red-400" : costTrend === "medium" ? "text-amber-400" : "text-emerald-400"

  return (
    <div className={cn(
      "p-6 bg-zinc-900/50 border border-zinc-800 rounded-lg",
      className
    )}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-sm font-semibold text-zinc-200">Cost Analysis</h3>
        <DollarSign className="w-4 h-4 text-zinc-500" />
      </div>
      <div className="space-y-4">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/50">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-zinc-500">Estimated Cost</span>
            <span className={cn("text-2xl font-bold tabular-nums", costColor)}>
              ${metrics.estimatedCost.toFixed(4)}
            </span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Model: {metrics.modelName}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Total Tokens</div>
            <div className="text-lg font-semibold text-zinc-200 tabular-nums">
              {(metrics.totalTokens / 1000).toFixed(1)}K
            </div>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Input</div>
            <div className="text-lg font-semibold text-blue-400 tabular-nums">
              {(metrics.inputTokens / 1000).toFixed(1)}K
            </div>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Output</div>
            <div className="text-lg font-semibold text-purple-400 tabular-nums">
              {(metrics.outputTokens / 1000).toFixed(1)}K
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-zinc-500">Cost Breakdown</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-zinc-950/50 border border-zinc-800 rounded">
              <span className="text-xs text-zinc-400">Input tokens</span>
              <span className="text-xs font-mono text-zinc-300">
                ${metrics.costBreakdown.inputCost.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-zinc-950/50 border border-zinc-800 rounded">
              <span className="text-xs text-zinc-400">Output tokens</span>
              <span className="text-xs font-mono text-zinc-300">
                ${metrics.costBreakdown.outputCost.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-zinc-800/20 border border-zinc-800/50 rounded text-xs">
          <Zap className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          <span className="text-zinc-400">
            This cost estimate assumes model prices as of Q1 2024. Check your provider&apos;s latest pricing for accuracy.
          </span>
        </div>
      </div>
    </div>
  )
}

// Helper to calculate metrics from token counts
export function calculateCostMetrics(
  inputTokens: number,
  outputTokens: number,
  modelName: string
): CostMetrics {
  const prices = modelPrices[modelName] || { input: 0.0005, output: 0.0015 }
  const inputCost = (inputTokens * prices.input) / 1000
  const outputCost = (outputTokens * prices.output) / 1000

  return {
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    modelName,
    estimatedCost: inputCost + outputCost,
    costBreakdown: {
      inputCost,
      outputCost,
    },
  }
}
