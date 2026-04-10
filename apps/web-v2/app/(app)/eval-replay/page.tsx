"use client"

import { useState } from "react"
import { Play, RotateCcw, ChevronDown, Clock, Zap, Hash } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReplayTrace {
  id: string
  requestId: string
  input: string
  expectedOutput: string
  model: string
  project: string
  age: string
  regressionId: string
}

interface PromptVersion {
  id: string
  label: string
  version: string
  model: string
  promptText: string
}

interface ReplayResult {
  versionId: string
  output: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  score: number          // 0–1 eval score
  scoreLabel: string
  pass: boolean
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const traces: ReplayTrace[] = [
  {
    id: "t-001",
    requestId: "req_8f3a2",
    input: "Customer review: 'The delivery was late, but the product quality is amazing. Would still recommend!'",
    expectedOutput: '{"sentiment":"positive","confidence":0.82,"reasoning":"Mixed signals but net-positive recommendation"}',
    model: "claude-3-haiku",
    project: "sentiment-analyzer",
    age: "2h ago",
    regressionId: "reg-sentinel-001",
  },
  {
    id: "t-002",
    requestId: "req_2c9b1",
    input: "Customer review: 'Absolutely terrible experience. The app crashed three times and support was useless.'",
    expectedOutput: '{"sentiment":"negative","confidence":0.97,"reasoning":"Strong negative language throughout"}',
    model: "claude-3-haiku",
    project: "sentiment-analyzer",
    age: "4h ago",
    regressionId: "reg-sentinel-001",
  },
  {
    id: "t-003",
    requestId: "req_7d4e9",
    input: "Customer review: 'It works fine. Nothing special but does what it says on the tin.'",
    expectedOutput: '{"sentiment":"neutral","confidence":0.74,"reasoning":"Neutral language, no strong sentiment indicators"}',
    model: "claude-3-haiku",
    project: "sentiment-analyzer",
    age: "6h ago",
    regressionId: "reg-sentinel-001",
  },
]

const promptVersions: PromptVersion[] = [
  {
    id: "pv-baseline",
    label: "Baseline",
    version: "v0.9.3",
    model: "claude-3-haiku",
    promptText: `You are an expert sentiment analyzer. Classify the sentiment of customer feedback as one of: positive, neutral, negative.

Guidelines:
- Be objective and data-driven
- Consider context and nuance
- Look for explicit emotional language
- Assign a confidence score (0-1)

Output format: {"sentiment": "...", "confidence": 0.0, "reasoning": "..."}`,
  },
  {
    id: "pv-current",
    label: "Current",
    version: "v0.9.4",
    model: "claude-3-sonnet",
    promptText: `You are a world-class sentiment analysis AI with expertise in understanding customer emotions.

Classify the input text into exactly one category: POSITIVE, NEUTRAL, NEGATIVE.

Critical Guidelines:
- Analyze tone, word choice, and implicit sentiment
- Consider sarcasm and cultural context
- Penalize ambiguous feedback toward neutral
- Return a precise confidence score (0.0-1.0)

Output in JSON: {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "confidence": 0.95, "reasoning": "key indicator"}`,
  },
]

// Simulated replay outputs — pre-baked per trace × version
const simulatedResults: Record<string, Record<string, ReplayResult>> = {
  "t-001": {
    "pv-baseline": {
      versionId: "pv-baseline",
      output: '{"sentiment":"positive","confidence":0.81,"reasoning":"Customer acknowledges delivery issue but explicitly recommends — net positive"}',
      latencyMs: 340,
      inputTokens: 128,
      outputTokens: 42,
      score: 0.94,
      scoreLabel: "PASS",
      pass: true,
    },
    "pv-current": {
      versionId: "pv-current",
      output: '{"sentiment":"NEUTRAL","confidence":0.68,"reasoning":"Mixed signals detected — ambiguous feedback penalized toward neutral"}',
      latencyMs: 890,
      inputTokens: 162,
      outputTokens: 58,
      score: 0.31,
      scoreLabel: "FAIL",
      pass: false,
    },
  },
  "t-002": {
    "pv-baseline": {
      versionId: "pv-baseline",
      output: '{"sentiment":"negative","confidence":0.96,"reasoning":"Explicit negative language: terrible, crashed, useless"}',
      latencyMs: 290,
      inputTokens: 124,
      outputTokens: 38,
      score: 0.99,
      scoreLabel: "PASS",
      pass: true,
    },
    "pv-current": {
      versionId: "pv-current",
      output: '{"sentiment":"NEGATIVE","confidence":0.94,"reasoning":"Strong negative indicators across all dimensions"}',
      latencyMs: 740,
      inputTokens: 158,
      outputTokens: 51,
      score: 0.95,
      scoreLabel: "PASS",
      pass: true,
    },
  },
  "t-003": {
    "pv-baseline": {
      versionId: "pv-baseline",
      output: '{"sentiment":"neutral","confidence":0.73,"reasoning":"Neutral phrasing, no strong positive or negative markers"}',
      latencyMs: 310,
      inputTokens: 119,
      outputTokens: 36,
      score: 0.91,
      scoreLabel: "PASS",
      pass: true,
    },
    "pv-current": {
      versionId: "pv-current",
      output: '{"sentiment":"NEUTRAL","confidence":0.88,"reasoning":"Ambiguous feedback — no strong sentiment indicators, penalized to neutral"}',
      latencyMs: 810,
      inputTokens: 153,
      outputTokens: 49,
      score: 0.84,
      scoreLabel: "PASS",
      pass: true,
    },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreBadge({ score, pass }: { score: number; pass: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border",
      pass
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-red-500/10 border-red-500/20 text-red-400"
    )}>
      {pass ? "PASS" : "FAIL"} · {(score * 100).toFixed(0)}%
    </span>
  )
}

function MetricPill({ icon: Icon, value, label, highlight }: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
  highlight?: "warn" | "bad" | null
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/60 border border-zinc-700/60 rounded">
      <Icon className="w-3 h-3 text-zinc-600 shrink-0" />
      <span className={cn(
        "text-xs font-semibold tabular-nums",
        highlight === "bad"  ? "text-red-400" :
        highlight === "warn" ? "text-amber-400" :
        "text-zinc-200"
      )}>
        {value}
      </span>
      <span className="text-[10px] text-zinc-600">{label}</span>
    </div>
  )
}

// ── Result panel ──────────────────────────────────────────────────────────────

function ResultPanel({
  version,
  result,
  isBaseline,
}: {
  version: PromptVersion
  result: ReplayResult | null
  isBaseline: boolean
}) {
  return (
    <div className={cn(
      "flex-1 min-w-0 bg-zinc-900 border rounded-lg overflow-hidden",
      !result ? "border-zinc-800" :
      result.pass ? "border-emerald-500/30" : "border-red-500/30"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b flex items-center justify-between",
        !result ? "border-zinc-800" :
        result.pass ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
      )}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200">{version.label}</span>
            <span className="text-[10px] font-mono text-zinc-500">{version.version}</span>
            {isBaseline && (
              <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">baseline</span>
            )}
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">{version.model}</div>
        </div>
        {result && <ScoreBadge score={result.score} pass={result.pass} />}
      </div>

      {/* Output */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">
          Response
        </div>
        {result ? (
          <pre className={cn(
            "text-xs font-mono leading-relaxed whitespace-pre-wrap break-words p-3 rounded border",
            result.pass
              ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-300/90"
              : "bg-red-500/5 border-red-500/15 text-red-300/90"
          )}>
            {result.output}
          </pre>
        ) : (
          <div className="h-20 bg-zinc-800/30 border border-zinc-800 rounded flex items-center justify-center">
            <span className="text-xs text-zinc-700">Run replay to see output</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      {result && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <MetricPill icon={Clock} value={`${result.latencyMs}ms`} label="latency"
            highlight={result.latencyMs > 600 ? "warn" : null} />
          <MetricPill icon={Hash}  value={`${result.inputTokens}`}  label="in" />
          <MetricPill icon={Hash}  value={`${result.outputTokens}`} label="out" />
        </div>
      )}

      {/* Prompt preview (collapsed) */}
      <details className="border-t border-zinc-800">
        <summary className="px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-400 transition-colors flex items-center gap-1">
          <ChevronDown className="w-3 h-3" />
          Prompt
        </summary>
        <div className="px-4 pb-3">
          <pre className="text-[10px] font-mono text-zinc-600 whitespace-pre-wrap bg-zinc-950/60 border border-zinc-800 rounded p-3 leading-relaxed">
            {version.promptText}
          </pre>
        </div>
      </details>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EvalReplayPage() {
  const [selectedTrace,   setSelectedTrace]   = useState<string>(traces[0].id)
  const [running,         setRunning]          = useState(false)
  const [results,         setResults]          = useState<Record<string, ReplayResult> | null>(null)

  const trace = traces.find((t) => t.id === selectedTrace)!

  const runReplay = () => {
    setRunning(true)
    setResults(null)
    // Simulate network delay
    setTimeout(() => {
      setResults(simulatedResults[selectedTrace])
      setRunning(false)
    }, 1400)
  }

  const reset = () => setResults(null)

  // Delta summary
  const baseline = results?.["pv-baseline"]
  const current  = results?.["pv-current"]
  const latencyDelta  = baseline && current ? current.latencyMs - baseline.latencyMs : null
  const tokenDelta    = baseline && current
    ? (current.inputTokens + current.outputTokens) - (baseline.inputTokens + baseline.outputTokens)
    : null
  const regressionDetected = baseline?.pass && current && !current.pass

  return (
    <div className="min-h-full">
      <PageHeader
        title="Eval Replay"
        description="Re-run a production trace through baseline vs. current prompt to reproduce failures."
        right={
          results ? (
            regressionDetected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-400">Regression confirmed</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-400">No regression</span>
              </div>
            )
          ) : null
        }
      />

      <div className="p-6 space-y-4">

        {/* ── Trace selector ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Select Trace
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {traces.map((t) => (
              <div
                key={t.id}
                onClick={() => { setSelectedTrace(t.id); reset() }}
                className={cn(
                  "flex items-start gap-4 px-4 py-3 cursor-pointer transition-colors",
                  selectedTrace === t.id
                    ? "bg-zinc-800/60 border-l-2 border-l-zinc-400"
                    : "hover:bg-zinc-800/30 border-l-2 border-l-transparent"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-zinc-400">{t.requestId}</span>
                    <span className="text-[10px] text-zinc-700">{t.project}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">{t.input}</p>
                </div>
                <span className="text-xs text-zinc-700 shrink-0">{t.age}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Input detail ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Trace Input
            </span>
            <span className="text-xs font-mono text-zinc-600">{trace.requestId}</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">User Input</div>
              <div className="text-sm text-zinc-200 bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2 leading-relaxed">
                {trace.input}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Expected Output</div>
              <pre className="text-xs font-mono text-zinc-400 bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2">
                {trace.expectedOutput}
              </pre>
            </div>
          </div>
        </div>

        {/* ── Run controls ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={runReplay}
            disabled={running}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border transition-all",
              running
                ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed"
                : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:border-zinc-600"
            )}
          >
            {running ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                Running replay…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Replay
              </>
            )}
          </button>
          {results && (
            <button
              onClick={reset}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Side-by-side results ── */}
        <div className="flex gap-4">
          {promptVersions.map((v) => (
            <ResultPanel
              key={v.id}
              version={v}
              result={results ? results[v.id] : null}
              isBaseline={v.id === "pv-baseline"}
            />
          ))}
        </div>

        {/* ── Delta summary ── */}
        {results && baseline && current && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Delta Summary
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-zinc-800">
              {/* Score delta */}
              <div className="px-5 py-4">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Eval Score</div>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-xl font-semibold tabular-nums",
                    current.score < baseline.score ? "text-red-400" : "text-emerald-400"
                  )}>
                    {current.score < baseline.score ? "−" : "+"}{Math.abs(((current.score - baseline.score) * 100)).toFixed(0)}%
                  </span>
                  <span className="text-xs text-zinc-600">
                    {(baseline.score * 100).toFixed(0)} → {(current.score * 100).toFixed(0)}
                  </span>
                </div>
              </div>
              {/* Latency delta */}
              <div className="px-5 py-4">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Latency</div>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-xl font-semibold tabular-nums",
                    latencyDelta! > 0 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {latencyDelta! > 0 ? "+" : ""}{latencyDelta}ms
                  </span>
                  <span className="text-xs text-zinc-600">
                    {baseline.latencyMs} → {current.latencyMs}
                  </span>
                </div>
              </div>
              {/* Token delta */}
              <div className="px-5 py-4">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Total Tokens</div>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-xl font-semibold tabular-nums",
                    tokenDelta! > 0 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {tokenDelta! > 0 ? "+" : ""}{tokenDelta}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {baseline.inputTokens + baseline.outputTokens} → {current.inputTokens + current.outputTokens}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
