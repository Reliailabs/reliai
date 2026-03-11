import Link from "next/link";
import { AlertTriangle, ArrowLeft, BrainCircuit, Network, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  getReliabilityGraphGuardrailRecommendations,
  getReliabilityGraphHighRiskPatterns,
  getSystemGlobalIntelligence,
} from "@/lib/api";

function tone(level: string) {
  if (level === "high") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (level === "medium") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
}

function pct(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

export default async function SystemIntelligencePage() {
  const [patterns, recommendations, globalPatterns] = await Promise.all([
    getReliabilityGraphHighRiskPatterns().catch(() => ({ items: [] })),
    getReliabilityGraphGuardrailRecommendations().catch(() => ({ items: [] })),
    getSystemGlobalIntelligence().catch(() => ({ items: [] })),
  ]);

  const topPatterns = patterns.items.slice(0, 8);
  const recentGlobal = globalPatterns.items.slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.08),transparent_40%),radial-gradient(circle_at_top_right,rgba(180,83,9,0.12),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/system/platform" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to platform health
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliability knowledge graph</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Cross-project reliability intelligence</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Graph-backed pattern board for model, prompt, retrieval, guardrail, deployment, and incident
                correlations. This is the operator view of what the platform is learning from production traffic.
              </p>
            </div>
            <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
              Internal intelligence only
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <BrainCircuit className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">High-risk patterns</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{patterns.items.length}</p>
            <p className="mt-2 text-sm text-steel">Strong relationships mined from the operational graph.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Guardrail actions</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{recommendations.items.length}</p>
            <p className="mt-2 text-sm text-steel">Distinct graph-derived guardrail moves ready for review.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Network className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Global correlations</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{globalPatterns.items.length}</p>
            <p className="mt-2 text-sm text-steel">System-wide patterns aggregated across accessible traffic.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Top confidence</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">
              {patterns.items.length ? pct(Math.max(...patterns.items.map((item) => item.confidence))) : "0%"}
            </p>
            <p className="mt-2 text-sm text-steel">Highest observed confidence across currently exposed graph edges.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Card className="overflow-hidden rounded-[28px] border-zinc-300">
          <div className="border-b border-zinc-200 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Top reliability patterns</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Model and retrieval failure graph</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-steel">
                <tr>
                  <th className="px-5 py-3 font-medium">Pattern</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Traces</th>
                </tr>
              </thead>
              <tbody>
                {topPatterns.map((item) => (
                  <tr key={`${item.source_node_id}:${item.target_node_id}:${item.relationship_type}`} className="border-t border-zinc-200 align-top">
                    <td className="px-5 py-4 text-sm font-medium text-ink">{item.pattern.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${tone(item.risk_level)}`}>
                        {item.risk_level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-steel">{pct(item.confidence)}</td>
                    <td className="px-5 py-4 text-sm font-medium text-ink">{item.traces.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recommended guardrails</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Graph-derived protection moves</h2>
            <div className="mt-6 space-y-4">
              {recommendations.items.map((item) => (
                <div key={item.policy_type} className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-steel">{pct(item.confidence)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-steel">{item.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-steel">
                    {item.policy_type} · {item.recommended_action}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent cross-project patterns</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Global intelligence feed</h2>
            <div className="mt-6 space-y-3">
              {recentGlobal.map((item) => (
                <div key={`${item.source_node_id}:${item.target_node_id}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-ink">{item.pattern.replaceAll("_", " ")}</p>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${tone(item.risk_level)}`}>
                      {item.risk_level.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-steel">
                    {pct(item.confidence)} confidence · {item.traces.toLocaleString()} traces
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
