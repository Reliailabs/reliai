import { AlertTriangle, BrainCircuit, Network, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SubPageHeader } from "@/components/ui/sub-page-header";
import {
  getGlobalReliabilityPatterns,
  getReliabilityGraphGuardrailRecommendations,
  getReliabilityGraphHighRiskPatterns,
} from "@/lib/api";

function tone(level: string) {
  if (level === "high") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (level === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  return "bg-blue-500/10 text-blue-400 border-blue-500/30";
}

function pct(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

export default async function SystemIntelligencePage() {
  const [patterns, recommendations, globalPatterns] = await Promise.all([
    getReliabilityGraphHighRiskPatterns().catch(() => ({ items: [] })),
    getReliabilityGraphGuardrailRecommendations().catch(() => ({ items: [] })),
    getGlobalReliabilityPatterns().catch(() => ({ patterns: [] })),
  ]);

  const topPatterns = patterns.items.slice(0, 8);
  const recentGlobal = globalPatterns.patterns.slice(0, 6);

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="Reliability knowledge graph"
        title="Cross-project reliability intelligence"
        description="Graph-backed pattern board for model, prompt, retrieval, guardrail, deployment, and incident correlations. This is the operator view of what the platform is learning from production traffic."
        backHref="/system/platform"
        backLabel="Back to platform health"
        right={
          <div className="rounded-full border border-zinc-800 bg-zinc-900/85 px-5 py-3 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur">
            Internal intelligence only
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <BrainCircuit className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">High-risk patterns</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{patterns.items.length}</p>
          <p className="mt-2 text-sm text-zinc-400">Strong relationships mined from the operational graph.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Guardrail actions</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{recommendations.items.length}</p>
          <p className="mt-2 text-sm text-zinc-400">Distinct graph-derived guardrail moves ready for review.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Network className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Global correlations</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{globalPatterns.patterns.length}</p>
          <p className="mt-2 text-sm text-zinc-400">System-wide patterns aggregated across accessible traffic.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Top confidence</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">
            {patterns.items.length ? pct(Math.max(...patterns.items.map((item) => item.confidence))) : "0%"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">Highest observed confidence across currently exposed graph edges.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-800 px-6 py-5">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Top reliability patterns</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Model and retrieval failure graph</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Pattern</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Traces</th>
                </tr>
              </thead>
              <tbody>
                {topPatterns.map((item) => (
                  <tr key={`${item.source_node_id}:${item.target_node_id}:${item.relationship_type}`} className="border-t border-zinc-800 align-top">
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">{item.pattern.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${tone(item.risk_level)}`}>
                        {item.risk_level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400">{pct(item.confidence)}</td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">{item.traces.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Recommended guardrails</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Graph-derived protection moves</h2>
            <div className="mt-6 space-y-4">
              {recommendations.items.map((item) => (
                <div key={item.policy_type} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">{pct(item.confidence)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-400">
                    {(item.model_family ?? "model signal")} · {item.policy_type} · {item.recommended_action}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Emerging model regressions</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Global intelligence feed</h2>
            <div className="mt-6 space-y-3">
              {recentGlobal.map((item) => (
                <div key={`${item.model_family}:${item.issue}`} className="rounded-lg border border-zinc-800 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-zinc-100">{item.issue.replaceAll("_", " ")}</p>
                    <span className={`inline-flex rounded-lg border px-2 py-1 text-[11px] font-medium ${tone(item.risk_level)}`}>
                      {item.risk_level.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                    {item.model_family} · {item.trace_count.toLocaleString()} traces · {item.organizations_affected} orgs
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                    {pct(item.confidence)} confidence · first seen {item.first_seen ? new Date(item.first_seen).toLocaleDateString() : "n/a"}
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