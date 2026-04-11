"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

type Section = "high-risk" | "models" | "prompts" | "guardrails"

interface IntelligenceViewProps {
  globalPatterns: any | null
  models: any | null
  prompts: any | null
  guardrails: any | null
}

const sectionLabels: Record<Section, string> = {
  "high-risk": "High‑Risk Patterns",
  "models": "Model Reliability",
  "prompts": "Prompt Failure Patterns",
  "guardrails": "Guardrail Recommendations",
}

export function IntelligenceView({
  globalPatterns,
  models,
  prompts,
  guardrails,
}: IntelligenceViewProps) {
  const [section, setSection] = useState<Section>("high-risk")

  const sections: Section[] = ["high-risk", "models", "prompts", "guardrails"]

  return (
    <div className="min-h-full">
      <PageHeader
        title="Reliability Intelligence"
        description="Cross‑project patterns, model risks, prompt failures, and guardrail effectiveness"
      />

      <div className="flex gap-0 border-b border-zinc-800 px-6">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors -mb-px",
              section === s
                ? "text-zinc-100 border-b-2 border-zinc-200"
                : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
            )}
          >
            {sectionLabels[s]}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {section === "high-risk" && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              High‑Risk Patterns
            </div>
            {globalPatterns?.items && globalPatterns.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Pattern</div>
                  <div>Projects</div>
                  <div className="text-right">Impact</div>
                  <div className="text-right">Last Seen</div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {globalPatterns.items.slice(0, 10).map((p: any) => (
                    <div key={p.id} className="grid grid-cols-4 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                      <div className="text-sm font-medium text-zinc-100">{p.pattern_type}</div>
                      <div className="text-sm text-zinc-400">{p.project_count} projects</div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm tabular-nums font-medium",
                          p.impact_score > 0.7 ? "text-red-400" :
                          p.impact_score > 0.4 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {p.impact_score != null ? `${(p.impact_score * 100).toFixed(0)}%` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-600">
                          {p.last_seen ? new Date(p.last_seen).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No high‑risk patterns detected
              </div>
            )}
          </div>
        )}

        {section === "models" && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Model Reliability
            </div>
            {models?.items && models.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Model</div>
                  <div>Provider</div>
                  <div className="text-right">Pass Rate</div>
                  <div className="text-right">Latency p95</div>
                  <div className="text-right">Cost / 1k</div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {models.items.slice(0, 10).map((m: any) => (
                    <div key={m.id} className="grid grid-cols-5 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                      <div className="text-sm font-medium text-zinc-100">{m.model_name}</div>
                      <div className="text-sm text-zinc-400">{m.provider ?? "—"}</div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm tabular-nums font-medium",
                          m.pass_rate >= 0.9 ? "text-emerald-400" :
                          m.pass_rate >= 0.7 ? "text-amber-400" : "text-red-400"
                        )}>
                          {m.pass_rate != null ? `${(m.pass_rate * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm tabular-nums text-zinc-200">
                          {m.latency_p95 != null ? `${m.latency_p95}ms` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm tabular-nums text-zinc-200">
                          {m.cost_per_1k != null ? `$${m.cost_per_1k.toFixed(4)}` : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No model reliability data
              </div>
            )}
          </div>
        )}

        {section === "prompts" && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Prompt Failure Patterns
            </div>
            {prompts?.items && prompts.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Pattern</div>
                  <div>Projects</div>
                  <div className="text-right">Failure Rate</div>
                  <div className="text-right">Last Seen</div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {prompts.items.slice(0, 10).map((p: any) => (
                    <div key={p.id} className="grid grid-cols-4 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                      <div className="text-sm font-medium text-zinc-100">{p.pattern_type}</div>
                      <div className="text-sm text-zinc-400">{p.project_count} projects</div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm tabular-nums font-medium",
                          p.failure_rate > 0.3 ? "text-red-400" :
                          p.failure_rate > 0.1 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {p.failure_rate != null ? `${(p.failure_rate * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-600">
                          {p.last_seen ? new Date(p.last_seen).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No prompt failure patterns
              </div>
            )}
          </div>
        )}

        {section === "guardrails" && (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Guardrail Recommendations
            </div>
            {guardrails?.items && guardrails.items.length > 0 ? (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  <div>Policy</div>
                  <div>Projects</div>
                  <div className="text-right">Effectiveness</div>
                  <div className="text-right">Recommendation</div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {guardrails.items.slice(0, 10).map((g: any) => (
                    <div key={g.id} className="grid grid-cols-4 gap-4 px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                      <div className="text-sm font-medium text-zinc-100">{g.policy_type}</div>
                      <div className="text-sm text-zinc-400">{g.project_count} projects</div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm tabular-nums font-medium",
                          g.effectiveness_score >= 0.8 ? "text-emerald-400" :
                          g.effectiveness_score >= 0.5 ? "text-amber-400" : "text-red-400"
                        )}>
                          {g.effectiveness_score != null ? `${(g.effectiveness_score * 100).toFixed(0)}%` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-zinc-300">{g.recommendation ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-6 text-center text-xs text-zinc-600">
                No guardrail recommendations
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}