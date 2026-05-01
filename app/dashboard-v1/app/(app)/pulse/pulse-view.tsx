import Link from "next/link";

import type { FirstTimeSetupState, PulseDecisionSummary, ReliabilityTimelineEvent } from "@reliai/types";
import { PageHeader } from "@/components/ui/page-header";
import { PanelError } from "@/components/ui/panel-error";

export type PulseIssue = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  reason: string;
  impact: string;
  href: string;
};

type PulseSetupChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
  href: string;
};

export function PulseView({
  now,
  decision,
  timeline,
  setupState,
  quickStats,
  recentIncidents,
  riskyTraces,
  latestAudit,
  deploymentSummary,
  formatRelative,
  dataMode,
  dataErrors,
  trendAvailable,
}: {
  now: number;
  decision: PulseDecisionSummary & { top_issues: PulseIssue[] };
  timeline: ReliabilityTimelineEvent[];
  setupState: FirstTimeSetupState & { checklist: PulseSetupChecklistItem[]; demo_mode: boolean };
  quickStats: {
    compliance_readiness: number;
    high_risk_outputs: number;
    model_drift_events: number;
    failed_evals: number;
  };
  recentIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    incident_type: string;
    project_name: string;
    updated_at: string;
  }>;
  riskyTraces: Array<{
    id: string;
    request_id: string;
    model_name: string;
    timestamp: string;
    success: boolean;
  }>;
  latestAudit: {
    audit: { name: string; updated_at: string };
    latest_run: { status: string; certification_status: string } | null;
  } | null;
  deploymentSummary: {
    total: number;
    latest: { id: string; deployed_at: string; environment: string } | null;
    regressionDetections: number;
  };
  formatRelative: (value: string) => string;
  dataMode: "live" | "demo";
  dataErrors: string[];
  trendAvailable: boolean;
}) {
  const deltaValue = trendAvailable ? (decision.arei.delta ?? 0) : 0;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Reliai Pulse"
        description="Real-time reliability command center for production AI systems."
      />

      <div className="p-6 space-y-6">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Data mode</p>
            <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${dataMode === "demo" ? "border-amber-700 bg-amber-950/40 text-amber-300" : "border-emerald-700 bg-emerald-950/40 text-emerald-300"}`}>
              {dataMode === "demo" ? "demo data" : "live data"}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">
            {dataMode === "demo"
              ? "This view uses isolated sample reliability data for walkthroughs and screenshots."
              : "This view is populated from current organization reliability signals."}
          </p>
          {dataErrors.length > 0 ? (
            <div className="mt-2">
              <PanelError detail={`Data source unavailable: ${dataErrors.join(", ")}.`} />
            </div>
          ) : null}
        </section>

        <section
          className={`rounded-lg px-4 py-3 ${
            decision.at_risk
              ? "border border-rose-700 bg-rose-950/40"
              : "border border-emerald-700/60 bg-emerald-950/20"
          }`}
        >
          <p
            className={`text-xs uppercase tracking-widest ${
              decision.at_risk ? "text-rose-300" : "text-emerald-300"
            }`}
          >
            {decision.at_risk ? "At Risk" : "Risk Posture Stable"}
          </p>
          <p className={`mt-1 text-sm ${decision.at_risk ? "text-rose-100" : "text-emerald-100"}`}>
            {decision.at_risk
              ? decision.at_risk_reason
              : "No high-severity reliability exposure is currently active."}
          </p>
          <p className={`mt-1 text-xs ${decision.at_risk ? "text-rose-200/80" : "text-emerald-200/80"}`}>
            {decision.why_it_matters}
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">AI Reliability Exposure Index</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-semibold text-zinc-100 tabular-nums">{decision.arei.score}</p>
              <p className={`text-sm ${deltaValue >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {trendAvailable ? `${deltaValue >= 0 ? "+" : ""}${deltaValue} trend` : "Trend unavailable"}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400">
              {decision.arei.breakdown.map((item) => (
                <div key={item.label} className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 flex items-center justify-between">
                  <span>{item.label}</span>
                  <span className="tabular-nums text-zinc-200">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Top drivers</p>
                <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                  {decision.topDrivers.slice(0, 3).map((driver) => (
                    <li key={driver}>• {driver}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Recommended actions</p>
                <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                  {decision.recommendedActions.slice(0, 3).map((action) => (
                    <li key={action}>• {action}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Recommended Action</p>
            <p className="mt-2 text-sm font-medium text-zinc-100">{decision.recommended_action.title}</p>
            <Link href={decision.recommended_action.href} className="mt-4 inline-flex rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white">
              {decision.recommended_action.cta}
            </Link>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <MetricCard label="High-risk outputs" value={quickStats.high_risk_outputs} />
              <MetricCard label="Failed evals" value={quickStats.failed_evals} />
              <MetricCard label="Model drift events" value={quickStats.model_drift_events} />
              <MetricCard label="Compliance readiness" value={quickStats.compliance_readiness} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">Top 3 issues</p>
              <span className="text-[10px] text-zinc-600">updated {new Date(now).toLocaleTimeString()}</span>
            </div>
            <div className="mt-3 space-y-2">
              {decision.top_issues.map((issue) => (
                <Link key={issue.id} href={issue.href} className="block rounded border border-zinc-800 bg-zinc-950 px-3 py-2 hover:border-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-100">{issue.title}</p>
                    <SeverityChip severity={issue.severity} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{issue.reason}</p>
                  <p className="mt-1 text-xs text-zinc-500">Impact: {issue.impact}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">What changed recently</p>
            <div className="mt-3 space-y-2 max-h-[22rem] overflow-auto">
              {timeline.length === 0 ? (
                <p className="text-sm text-zinc-500">No reliability events yet.</p>
              ) : (
                timeline.map((event) => (
                  <Link key={event.id} href={event.href || "/pulse"} className="block rounded border border-zinc-800 bg-zinc-950 px-3 py-2 hover:border-zinc-700">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-zinc-100">{event.title}</p>
                      <span className="text-[10px] uppercase text-zinc-500">{event.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{event.impact}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{formatRelative(event.occurred_at)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Recent incidents</p>
            <div className="mt-3 space-y-2">
              {recentIncidents.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No incidents detected. Reliai will surface grouped reliability failures here when action is needed.
                </p>
              ) : (
                recentIncidents.map((incident) => (
                  <Link key={incident.id} href={`/incidents/${incident.id}`} className="block rounded border border-zinc-800 bg-zinc-950 px-3 py-2 hover:border-zinc-700">
                    <p className="text-sm text-zinc-100">{incident.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {incident.project_name} · {incident.incident_type} · {incident.severity} · {incident.status}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">{formatRelative(incident.updated_at)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">High-risk outputs</p>
            <div className="mt-3 space-y-2">
              {riskyTraces.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No traces yet. Connect your AI system or run your first audit to start monitoring reliability.
                </p>
              ) : (
                riskyTraces.map((trace) => (
                  <Link key={trace.id} href={`/traces/${trace.id}`} className="block rounded border border-zinc-800 bg-zinc-950 px-3 py-2 hover:border-zinc-700">
                    <p className="text-sm text-zinc-100">Trace {trace.request_id}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {trace.model_name} · {trace.success ? "ok" : "failed output"}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">{formatRelative(trace.timestamp)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Latest audit state</p>
            {latestAudit ? (
              <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-3">
                <p className="text-sm text-zinc-100">{latestAudit.audit.name}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Run: {latestAudit.latest_run?.status ?? "draft"} · Certification: {latestAudit.latest_run?.certification_status ?? "pending"}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">{formatRelative(latestAudit.audit.updated_at)}</p>
                <Link href="/audits" className="mt-3 inline-flex rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
                  Open audits
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                No audits yet. Run your first audit to establish compliance readiness.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Deployment correlation</p>
            <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-3">
              <p className="text-sm text-zinc-100">Deployments tracked: {deploymentSummary.total}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Regression detections linked to deployment window: {deploymentSummary.regressionDetections}
              </p>
              {deploymentSummary.latest ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Latest deploy {deploymentSummary.latest.environment} · {formatRelative(deploymentSummary.latest.deployed_at)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">
                  No deployments found. Add deployment metadata to correlate regressions with releases.
                </p>
              )}
              <Link href="/deployments" className="mt-3 inline-flex rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
                Open deployments
              </Link>
            </div>
          </div>
        </section>

        {!setupState.has_data ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">First-time setup</p>
              <Link
                href={setupState.demo_mode ? "/pulse" : "/pulse?demo=1"}
                className="text-xs rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
              >
                {setupState.demo_mode ? "Disable demo mode" : "Enable demo mode"}
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              No live reliability data yet. Complete setup actions or use demo mode to preview decision workflows.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {setupState.checklist.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700"
                >
                  <span className={item.complete ? "text-emerald-400" : "text-zinc-400"}>
                    {item.complete ? "✓" : "○"}
                  </span>{" "}
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 px-2 py-2">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}

function SeverityChip({ severity }: { severity: PulseIssue["severity"] }) {
  const tone =
    severity === "critical"
      ? "text-rose-300 border-rose-700 bg-rose-950/50"
      : severity === "high"
        ? "text-amber-300 border-amber-700 bg-amber-950/40"
        : severity === "medium"
          ? "text-zinc-300 border-zinc-700 bg-zinc-900"
          : "text-blue-300 border-blue-700 bg-blue-950/40";

  return <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${tone}`}>{severity}</span>;
}
