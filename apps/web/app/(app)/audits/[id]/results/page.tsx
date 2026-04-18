import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuditResults } from "@/lib/api";

function riskLevel(score: number | null) {
  if (score === null) return "pending";
  if (score >= 80) return "low";
  if (score >= 60) return "moderate";
  if (score >= 40) return "high";
  return "critical";
}

export default async function AuditResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const results = await getAuditResults(id).catch(() => null);

  if (!results) {
    return (
      <Card className="rounded-2xl border-line bg-surface p-6">
        <h1 className="text-lg font-semibold text-primary">Results unavailable</h1>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">Audit Results</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-primary">{results.audit.name}</h1>
            <p className="mt-2 text-sm text-secondary">Run {results.run.id}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/audits/${id}`}>Back to audit</Link>
          </Button>
        </div>
      </header>

      {results.run.certification_status === "pending" ? (
        <Card className="rounded-2xl border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Certification is currently pending. A rerun or in-progress stage has invalidated fresh completed results.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border-line bg-surface p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Executive Summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-3 text-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Certification</p>
              <p className="mt-1 font-semibold text-primary">{results.run.certification_status}</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-3 text-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Risk score</p>
              <p className="mt-1 font-semibold text-primary">{results.run.risk_score ?? "—"} ({riskLevel(results.run.risk_score)})</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-secondary">{results.summary}</p>
          <div className="mt-4 text-sm text-secondary">
            <p className="font-medium text-primary">Top risks</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {results.top_risks.length === 0 ? <li>No high-impact risks reported.</li> : results.top_risks.map((risk) => <li key={risk}>{risk}</li>)}
            </ul>
          </div>
          <div className="mt-4 text-sm text-secondary">
            <p className="font-medium text-primary">Recommended next actions</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {results.recommended_actions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Risk Breakdown</h2>
          <div className="mt-4 space-y-2 text-sm text-secondary">
            {Object.entries(results.findings_summary.severity_counts).map(([severity, count]) => (
              <p key={severity} className="flex items-center justify-between">
                <span>{severity}</span>
                <span className="font-semibold text-primary">{count}</span>
              </p>
            ))}
            <p className="flex items-center justify-between border-t border-line pt-2">
              <span>Blocking issues</span>
              <span className="font-semibold text-primary">{results.findings_summary.blocking_open}</span>
            </p>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Production Evidence</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm text-secondary">
          <p>
            Window: {String(results.run.production_snapshot_metadata?.evidenceWindow?.start ?? "—")} →{" "}
            {String(results.run.production_snapshot_metadata?.evidenceWindow?.end ?? "—")}
          </p>
          <p>Evidence impact: {results.run.production_snapshot_metadata ? "Included in risk and certification review." : "No linked production snapshot."}</p>
          <p>Incidents: {String(results.run.production_snapshot_metadata?.incidentSummary?.count ?? 0)}</p>
          <p>Guardrail violations: {String(results.run.production_snapshot_metadata?.guardrailViolationSummary?.count ?? 0)}</p>
          <p>Regressions: {String(results.run.production_snapshot_metadata?.regressionSummary?.count ?? 0)}</p>
          <p>Trace samples: {String(results.run.production_snapshot_metadata?.traceSampleSummary?.sampleCount ?? 0)}</p>
        </div>
      </Card>

      <Card className="rounded-2xl border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Findings</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-left text-sm text-secondary">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-secondary">
                <th className="px-2 py-1">Title</th>
                <th className="px-2 py-1">Category</th>
                <th className="px-2 py-1">Severity</th>
                <th className="px-2 py-1">Validated</th>
                <th className="px-2 py-1">Confidence</th>
                <th className="px-2 py-1">Origin</th>
              </tr>
            </thead>
            <tbody>
              {results.findings.map((finding) => (
                <tr key={finding.id} className="rounded-lg border border-line bg-white">
                  <td className="px-2 py-2 align-top">
                    <p className="font-medium text-primary">{finding.title}</p>
                    <p className="mt-1 text-xs">{finding.summary}</p>
                  </td>
                  <td className="px-2 py-2 align-top">{finding.category}</td>
                  <td className="px-2 py-2 align-top">{finding.severity}</td>
                  <td className="px-2 py-2 align-top">{finding.is_validated ? "yes" : "no"}</td>
                  <td className="px-2 py-2 align-top">{finding.confidence ?? "—"}</td>
                  <td className="px-2 py-2 align-top">{finding.origin_source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="rounded-2xl border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Certification</h2>
        <p className="mt-3 text-sm text-secondary">Final decision: <span className="font-semibold text-primary">{results.run.certification_status}</span></p>
        <p className="mt-2 text-sm text-secondary">Blockers: {results.findings_summary.blocking_open}</p>
        <p className="mt-2 text-sm text-secondary">Required remediation: resolve open high/critical findings and re-run certification stage.</p>
      </Card>

      <Card className="rounded-2xl border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Suggested Monitoring</h2>
        {results.monitoring_recommendations.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">No monitoring recommendations generated.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {results.monitoring_recommendations.map((item) => (
              <div key={item.id} className="rounded-lg border border-line bg-white p-3 text-sm text-secondary">
                <p className="font-medium text-primary">{item.recommendation_type}</p>
                <p className="mt-1">Scope: {item.scope || "—"}</p>
                <p className="mt-1">Threshold: {item.threshold_hint || "—"}</p>
                <p className="mt-1">{item.reason}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="rounded-2xl border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Artifacts / Evidence</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {results.artifacts.map((artifact) => (
            <span key={artifact.id} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-secondary">
              {artifact.artifact_type}: {artifact.title}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
