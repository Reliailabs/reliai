"use client"

import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"


// Character-level diff highlighting




// Component to render character-diff
function DiffRenderer({ before, after }: { before: string; after: string }) {
  // For simplicity, we'll show before/after with visual diff
  // In production, use a library like react-diff-viewer

  const beforeLines = before.split("\n")
  const afterLines = after.split("\n")

  return (
    <div className="grid grid-cols-2 gap-4 min-h-[400px]">
      {/* Before */}
      <div className="border border-zinc-800 rounded bg-zinc-950/50 overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-400">
          Before
        </div>
        <div className="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
          <div className="text-zinc-300 whitespace-pre-wrap break-words">
            {beforeLines.map((line, i) => (
              <div key={i} className="text-red-400/70">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* After */}
      <div className="border border-zinc-800 rounded bg-zinc-950/50 overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-400">
          After
        </div>
        <div className="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
          <div className="text-zinc-300 whitespace-pre-wrap break-words">
            {afterLines.map((line, i) => (
              <div key={i} className="text-emerald-400/70">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Mock regression data
const mockRegression = {
  id: "reg-sentinel-001",
  project: "sentiment-analyzer",
  title: "Regression in Positive Sentiment Detection",
  description: "System started misclassifying neutral feedback as positive in 15% of cases",
  beforePrompt: `You are an expert sentiment analyzer. Your task is to classify the sentiment of customer feedback.

Classify the input text as one of: positive, neutral, negative.

Guidelines:
- Be objective and data-driven
- Consider context and nuance
- Look for explicit emotional language
- Assign a confidence score (0-1)

Output format: {"sentiment": "...", "confidence": 0.0, "reasoning": "..."}`,

  afterPrompt: `You are a world-class sentiment analysis AI with expertise in understanding customer emotions.

Classify the input text into exactly one category: POSITIVE, NEUTRAL, NEGATIVE.

Critical Guidelines:
- Analyze tone, word choice, and implicit sentiment
- Consider sarcasm and cultural context
- Penalize ambiguous feedback toward neutral
- Return a precise confidence score (0.0-1.0)
- Explain your reasoning briefly

Output in JSON: {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "confidence": 0.95, "reasoning": "key indicator"}`,

  beforeModel: "claude-3-haiku",
  afterModel: "claude-3-sonnet",
  beforeVersion: "v0.9.3",
  afterVersion: "v0.9.4",
  changeDate: "2024-01-14T10:30:00Z",
  impactMetrics: {
    errorRateIncrease: "3.2%",
    latencyIncrease: "240ms",
    tokensPerRequest: "+45%",
  },
}

export default function PromptDiffPage() {
  const [viewMode, setViewMode] = useState<"split" | "unified">("split")

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Prompt Diff Viewer"
        description="Compare prompt changes that led to regressions"
        right={
          <Link href="/regressions" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span className="ml-1 text-xs">Back</span>
          </Link>
        }
      />

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-semibold text-zinc-200">{mockRegression.title}</h2>
          <span className="text-xs text-zinc-500">{mockRegression.id}</span>
        </div>
        <p className="text-sm text-zinc-400 mb-4">{mockRegression.description}</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Model Changed</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                {mockRegression.beforeModel}
              </span>
              <span className="text-zinc-500">→</span>
              <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400">
                {mockRegression.afterModel}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">Version Changed</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                {mockRegression.beforeVersion}
              </span>
              <span className="text-zinc-500">→</span>
              <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400">
                {mockRegression.afterVersion}
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <div className="text-xs text-zinc-500 mb-3">Impact Metrics</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
              <div className="text-xs text-red-400">{mockRegression.impactMetrics.errorRateIncrease}</div>
              <div className="text-xs text-zinc-500 mt-1">Error Rate Increase</div>
            </div>
            <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
              <div className="text-xs text-orange-400">{mockRegression.impactMetrics.latencyIncrease}</div>
              <div className="text-xs text-zinc-500 mt-1">Latency Increase</div>
            </div>
            <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
              <div className="text-xs text-amber-400">{mockRegression.impactMetrics.tokensPerRequest}</div>
              <div className="text-xs text-zinc-500 mt-1">Token Cost</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("split")}
          className={cn(
            "px-3 py-1.5 text-xs rounded transition-colors font-medium",
            viewMode === "split"
              ? "bg-zinc-700 text-zinc-200"
              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          )}
        >
          Split View
        </button>
        <button
          onClick={() => setViewMode("unified")}
          className={cn(
            "px-3 py-1.5 text-xs rounded transition-colors font-medium",
            viewMode === "unified"
              ? "bg-zinc-700 text-zinc-200"
              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          )}
        >
          Unified View
        </button>
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-200">Prompt Changes</h3>
        </div>
        <div className="p-6">
            {viewMode === "split" ? ( 
            <DiffRenderer before={mockRegression.beforePrompt} after={mockRegression.afterPrompt} />
          ) : (
            <div className="space-y-6 font-mono text-sm leading-relaxed">
              <div>
                <h4 className="text-xs font-semibold text-red-400 mb-2">Removed Lines</h4>
                <pre className="bg-red-500/5 border border-red-500/20 rounded p-4 text-red-300 overflow-x-auto">
                  {mockRegression.beforePrompt.replace(/"/g, '&quot;')}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-emerald-400 mb-2">Added Lines</h4>
                <pre className="bg-emerald-500/5 border border-emerald-500/20 rounded p-4 text-emerald-300 overflow-x-auto">
                    {mockRegression.afterPrompt.replace(/"/g, '&quot;')}
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    {`If you see a &quot;-&quot; in the diff, it means the model removed that part. If you see a &quot;+&quot;, it means the model added it.`}
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    {`The model's &quot;before&quot; and &quot;after&quot; responses are shown below. Differences are highlighted.`}
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    {`If you see a &quot;-&quot; in the diff, it means the model removed that part. If you see a &quot;+&quot;, it means the model added it.`}
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    {`The model's &quot;before&quot; and &quot;after&quot; responses are shown below. Differences are highlighted.`}
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    {`If you see a &quot;-&quot; in the diff, it means the model removed that part. If you see a &quot;+&quot;, it means the model added it.`}
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    {`The model's &quot;before&quot; and &quot;after&quot; responses are shown below. Differences are highlighted.`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Analysis</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex gap-3">
            <span className="text-amber-400 shrink-0">•</span>
            <span>Prompt was changed to use stricter formatting requirements (UPPERCASE sentiment values)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 shrink-0">•</span>
            <span>Model upgraded from Haiku to Sonnet, increasing token consumption by 45%</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 shrink-0">•</span>
            <span>Added sarcasm detection logic may have over-corrected neutral vs. negative classification</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 shrink-0">•</span>
            <span>Recommend rolling back prompt to v0.9.3 or adjusting &quot;ambiguous → neutral&quot; penalty</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
