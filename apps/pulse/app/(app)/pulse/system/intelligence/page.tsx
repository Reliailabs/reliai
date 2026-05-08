import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemIntelligenceSurfaceData } from "@/lib/system-intelligence-data";

function tone(level: string) {
  if (level === "high") return "bg-destructive/10 text-destructive border-destructive/40";
  if (level === "medium") return "bg-warning/10 text-warning border-warning/40";
  return "bg-blue-500/10 text-blue-300 border-blue-500/40";
}

function pct(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

export default async function SystemIntelligencePage() {
  const { highRiskPatterns, guardrailRecommendations, globalPatterns, sourceErrors } =
    await getSystemIntelligenceSurfaceData();

  const topPatterns = highRiskPatterns.slice(0, 8);
  const recentGlobal = globalPatterns.slice(0, 6);
  const topConfidence = highRiskPatterns.length
    ? Math.max(...highRiskPatterns.map((item) => item.confidence))
    : 0;
  const highRiskCount = highRiskPatterns.filter((item) => item.risk_level === "high").length;
  const mediumRiskCount = highRiskPatterns.filter((item) => item.risk_level === "medium").length;
  const totalPatternTraces = highRiskPatterns.reduce((sum, item) => sum + item.traces, 0);
  const dominantPattern = highRiskPatterns[0] ?? null;

  return (
    <SystemLayoutShell
      title="Reliability Intelligence"
      description="Cross-project reliability intelligence across high-risk patterns, guardrail recommendations, and global model regressions."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {highRiskPatterns.length === 0 &&
      guardrailRecommendations.length === 0 &&
      globalPatterns.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          No intelligence signals are available yet.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">High-risk patterns</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{highRiskPatterns.length}</p>
              <p className="mt-2 text-xs text-muted-foreground">Strong reliability relationships in the graph layer.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guardrail actions</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{guardrailRecommendations.length}</p>
              <p className="mt-2 text-xs text-muted-foreground">Distinct graph-derived guardrail moves.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Global correlations</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{globalPatterns.length}</p>
              <p className="mt-2 text-xs text-muted-foreground">System-wide patterns across accessible traffic.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top confidence</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{pct(topConfidence)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Highest observed confidence in current graph edges.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Operational intelligence summary</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Advisory-only synthesis of cross-project reliability trends. Requires operator review.
                </p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                Requires operator review
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Risk mix</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{highRiskCount + mediumRiskCount}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {highRiskCount} high-risk and {mediumRiskCount} medium-risk relationships in active graph edges.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Primary pattern</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {dominantPattern ? dominantPattern.pattern.replaceAll("_", " ") : "Insufficient data"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {dominantPattern
                    ? `${pct(dominantPattern.confidence)} confidence, ${dominantPattern.traces.toLocaleString()} supporting traces.`
                    : "No dominant relationship identified in the current evidence set."}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Evidence coverage</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {totalPatternTraces > 0 ? `${totalPatternTraces.toLocaleString()} traces` : "Insufficient data"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {totalPatternTraces > 0
                    ? "Validate recommendations against deployment and incident timelines before action."
                    : "Collect additional traces and incidents to improve pattern confidence."}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">Top reliability patterns</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Pattern</th>
                      <th className="px-3 py-2 font-medium">Risk</th>
                      <th className="px-3 py-2 font-medium">Confidence</th>
                      <th className="px-3 py-2 font-medium">Traces</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topPatterns.map((item) => (
                      <tr
                        key={`${item.source_node_id}:${item.target_node_id}:${item.relationship_type}`}
                        className="align-top"
                      >
                        <td className="px-3 py-3 text-sm font-medium text-foreground">
                          {item.pattern.replaceAll("_", " ")}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${tone(item.risk_level)}`}
                          >
                            {item.risk_level.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{pct(item.confidence)}</td>
                        <td className="px-3 py-3 text-sm font-medium text-foreground">{item.traces.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-foreground">Recommended guardrails</h2>
                <div className="mt-4 space-y-3">
                  {guardrailRecommendations.map((item) => (
                    <div key={item.policy_type} className="rounded-lg border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {pct(item.confidence)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {(item.model_family ?? "model signal")} · {item.policy_type} · {item.recommended_action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-foreground">Global intelligence feed</h2>
                <div className="mt-4 space-y-3">
                  {recentGlobal.map((item) => (
                    <div key={`${item.model_family}:${item.issue}`} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-foreground">{item.issue.replaceAll("_", " ")}</p>
                        <span className={`inline-flex rounded-lg border px-2 py-1 text-[11px] font-medium ${tone(item.risk_level)}`}>
                          {item.risk_level.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.model_family} · {item.trace_count.toLocaleString()} traces · {item.organizations_affected} orgs
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pct(item.confidence)} confidence · first seen{" "}
                        {item.first_seen ? new Date(item.first_seen).toLocaleDateString() : "n/a"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </SystemLayoutShell>
  );
}
