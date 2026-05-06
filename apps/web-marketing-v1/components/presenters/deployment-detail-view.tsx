import Link from "next/link";
import { ArrowLeft, ArrowRight, GitCommitHorizontal, History, ShieldAlert } from "lucide-react";

import type { DeploymentDetailRead } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RecommendationCallout } from "@/components/ui/recommendation-callout";
import { gateLabel, gateTone, renderMetadata } from "@/components/presenters/ops-format";
import { cn } from "@/lib/utils";

interface DeploymentDetailViewProps {
  detail: DeploymentDetailRead;
  screenshotMode?: boolean;
}

export function DeploymentDetailView({ detail, screenshotMode = false }: DeploymentDetailViewProps) {
  const intelligence = detail.intelligence;
  const gate = detail.gate;

  return (
    <div
      className={cn("space-y-6", screenshotMode && "mx-auto w-[1600px] max-w-[1600px] space-y-5 overflow-hidden bg-white p-8")}
      data-deployment-detail
      data-deployment-detail-ready={screenshotMode ? "" : undefined}
    >
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        {!screenshotMode ? (
          <Link
            href={`/projects/${detail.project_id}/timeline`}
            className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to timeline
          </Link>
        ) : (
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Reliai deployment gate</p>
        )}
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Deployment detail</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">
              {detail.prompt_version?.version ?? "Prompt n/a"} · {detail.model_version?.model_name ?? "Model n/a"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-secondary">
              {detail.environment} {screenshotMode ? "· current release window" : `· ${new Date(detail.deployed_at).toLocaleString()}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {gate ? (
              <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${gateTone(gate.decision)}`}>
                Deployment Safety Check: {gateLabel(gate.decision)}
              </div>
            ) : null}
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-secondary">
              {detail.deployed_by ?? "unknown deployer"}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <GitCommitHorizontal className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Deployment metadata</p>
              <h2 className="mt-2 text-2xl font-semibold text-primary">Change record</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Prompt version</p>
              <p className="mt-2 text-sm font-medium text-primary">{detail.prompt_version?.version ?? "n/a"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Model version</p>
              <p className="mt-2 text-sm font-medium text-primary">{detail.model_version?.model_name ?? "n/a"}</p>
            </div>
          </div>
          <pre className={cn("mt-5 overflow-x-auto rounded-[24px] border border-zinc-200 px-4 py-4 text-xs leading-6", screenshotMode ? "bg-zinc-100 text-zinc-800" : "bg-zinc-950 text-zinc-100")}>
            {renderMetadata(detail.metadata_json as Record<string, unknown> | null | undefined)}
          </pre>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Deployment safety check</p>
              <h2 className="mt-2 text-2xl font-semibold text-primary">Gate decision</h2>
            </div>
          </div>
          {gate ? (
            <div className="mt-5 space-y-4">
              <div className={`rounded-[24px] border px-4 py-4 ${gateTone(gate.decision)}`}>
                <p className="text-xs uppercase tracking-[0.18em]">Safety state</p>
                <p className="mt-2 text-2xl font-semibold">{gateLabel(gate.decision)}</p>
                <p className="mt-2 text-sm">Risk score: {gate.risk_score}/100</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-sm font-medium text-primary">Deployment risk factors</p>
                <ul className="mt-3 space-y-2 text-sm text-secondary">
                  {gate.explanations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {gate.regression_risk?.is_regression ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                  <p className="text-sm font-semibold text-rose-900">Regression risk detected</p>
                  <ul className="mt-3 space-y-2 text-sm text-rose-800">
                    {gate.regression_risk.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" className="rounded-full bg-rose-600 text-white hover:bg-rose-700">
                      Deploy anyway
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full border-rose-200 text-rose-700">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-secondary">
              No deployment gate result is available yet.
            </p>
          )}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">AI reliability insights</p>
              <h2 className="mt-2 text-2xl font-semibold text-primary">Known failure patterns</h2>
            </div>
          </div>
          {intelligence && (intelligence.graph_risk_patterns.length > 0 || intelligence.recommended_guardrails.length > 0) ? (
            <div className="mt-5 space-y-4">
              <RecommendationCallout
                recommendation="Review the traces that triggered the deployment risk patterns before proceeding."
                supporting={
                  intelligence.risk_explanations.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {intelligence.risk_explanations.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2">Graph correlations indicate elevated deployment risk for this change.</p>
                  )
                }
                className={screenshotMode ? "!bg-zinc-50 !border-zinc-200 [&_p]:!text-zinc-700 [&_li]:!text-zinc-700" : undefined}
              />
              {intelligence.graph_risk_patterns.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {intelligence.graph_risk_patterns.map((item) => (
                    <div key={`${item.pattern}-${item.trace_count}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                      <p className="text-sm font-medium text-primary">{item.pattern}</p>
                      <p className="mt-1 text-sm text-secondary">
                        {item.risk} risk · {item.trace_count.toLocaleString()} traces
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {intelligence.recommended_guardrails.length > 0 ? (
                <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                  <p className="text-sm font-medium text-primary">Recommended guardrails</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {intelligence.recommended_guardrails.map((item) => (
                      <span
                        key={item}
                        className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-secondary">
              No graph-backed reliability patterns are currently attached to this deployment.
            </p>
          )}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Deployment risk factors</p>
              <h2 className="mt-2 text-2xl font-semibold text-primary">Why this change is safe or risky</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">High regression probability</p>
              <p className="mt-3 text-sm text-secondary">
                {gate?.decision === "BLOCK" || (intelligence?.risk_score ?? 0) >= 70
                  ? "Current deployment signals indicate elevated regression risk."
                  : "No major regression probability spike is currently attached."}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Cross-organization failures</p>
              <p className="mt-3 text-sm text-secondary">
                {intelligence?.graph_risk_patterns.length
                  ? "Similar failure patterns have been seen in the reliability graph."
                  : "No cross-project failure pattern is currently attached."}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Guardrail coverage</p>
              <p className="mt-3 text-sm text-secondary">
                {gate?.recommended_guardrails.length
                  ? "Additional guardrail coverage is recommended before rollout."
                  : "Current deployment did not trigger extra guardrail coverage recommendations."}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Recent incident correlation</p>
              <p className="mt-3 text-sm text-secondary">
                {detail.incident_ids.length
                  ? `${detail.incident_ids.length} linked incident${detail.incident_ids.length === 1 ? "" : "s"} already reference this deployment.`
                  : "No incident has been linked to this deployment yet."}
              </p>
            </div>
          </div>
        </Card>

        {!screenshotMode ? (
          <div className="space-y-6">
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-secondary">Deployment events</p>
                  <h2 className="mt-2 text-2xl font-semibold text-primary">Timeline</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {detail.events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                    <p className="text-sm font-medium text-primary">{event.event_type}</p>
                    <p className="mt-1 text-sm text-secondary">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[28px] border-zinc-300 p-6">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-secondary">Linked incidents</p>
                  <h2 className="mt-2 text-2xl font-semibold text-primary">Investigation paths</h2>
                </div>
              </div>
              {detail.incident_ids.length === 0 ? (
                <p className="mt-5 text-sm leading-6 text-secondary">No incidents currently linked to this deployment.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {detail.incident_ids.map((incidentId) => (
                    <Link
                      key={incidentId}
                      href={`/incidents/${incidentId}`}
                      className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                    >
                      <span className="text-sm font-medium text-primary">{incidentId}</span>
                      <ArrowRight className="h-4 w-4 text-secondary" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
