import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { IncidentCommandCenterRead } from "@reliai/types";

import { ActionCallout } from "@/components/ui/action-callout";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { formatTime, severityTone } from "@/components/presenters/ops-format";
import { cn } from "@/lib/utils";

interface SuggestedFix {
  title: string;
  description: string;
}

interface IncidentCommandCenterViewProps {
  incidentId: string;
  command: IncidentCommandCenterRead;
  suggestedFix?: SuggestedFix | null;
  screenshotMode?: boolean;
}

function formatEvidence(evidence: Record<string, unknown> | null): string[] {
  if (!evidence) return [];
  return Object.entries(evidence).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((item) => `${key}: ${String(item)}`);
    }
    if (value === null || value === undefined) return [];
    return `${key}: ${String(value)}`;
  });
}

export function IncidentCommandCenterView({
  incidentId,
  command,
  suggestedFix = null,
  screenshotMode = false,
}: IncidentCommandCenterViewProps) {
  const incident = command.incident;
  const summary = incident.summary_json ?? {};
  const metricKey = String(summary.metric_name ?? "");
  const currentValue = summary.current_value ? String(summary.current_value) : "n/a";
  const baselineValue = summary.baseline_value ? String(summary.baseline_value) : "n/a";
  const deltaPercent = summary.delta_percent ? `${summary.delta_percent}%` : "n/a";

  const errorsValue =
    metricKey.includes("error") || metricKey.includes("success") ? currentValue : "n/a";
  const latencyValue = metricKey.includes("latency") ? currentValue : "n/a";
  const retryValue = metricKey.includes("retry") ? currentValue : "n/a";

  const signalStrip = [
    { label: "errors/sec", value: errorsValue },
    { label: "latency", value: latencyValue },
    { label: "retries", value: retryValue },
  ];

  const rootCauseTitle =
    command.root_cause.root_cause_probabilities[0]?.label ?? "No dominant root cause yet";
  const evidence = formatEvidence(command.root_cause.evidence);

  return (
    <div
      className={cn(
        "space-y-4",
        screenshotMode && "mx-auto w-[1600px] max-w-[1600px] space-y-4 overflow-hidden bg-white p-8"
      )}
      data-incident-command-center
      data-incident-command-center-ready={screenshotMode ? "" : undefined}
    >
      <header className="rounded-[20px] border border-zinc-300 bg-white px-5 py-4">
        {!screenshotMode ? (
          <Link
            href={`/incidents/${incidentId}`}
            className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to incident
          </Link>
        ) : (
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliai incident command center</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <StatusDot status={incident.severity === "critical" ? "critical" : "neutral"} />
          <span className="font-semibold text-ink">{incident.title}</span>
          <span className="text-xs text-steel">{formatTime(incident.started_at, screenshotMode)}</span>
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${severityTone(incident.severity)}`}>
            {incident.severity}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-steel">
          {signalStrip.map((signal) => (
            <div key={signal.label} className="flex items-center gap-2">
              <span className="uppercase tracking-[0.2em] text-steel">{signal.label}</span>
              <span className="text-ink">{signal.value}</span>
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="space-y-4">
          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Root cause</p>
            <p className="mt-2 text-sm font-semibold text-ink">{rootCauseTitle}</p>
            <p className="mt-2 text-sm text-steel">{command.root_cause.recommended_fix.summary}</p>
            {evidence.length > 0 ? (
              <ul className="mt-3 text-xs text-steel">
                {evidence.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Trace evidence</p>
            <p className="mt-2 text-sm text-steel">Top failing trace is ready for review.</p>
            {!screenshotMode ? (
              <div className="mt-3">
                <Button asChild size="sm">
                  <a href={command.trace_compare.compare_link}>Open example trace</a>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Impact</p>
            <ul className="mt-2 text-sm text-steel">
              <li>• current value: {currentValue}</li>
              <li>• baseline value: {baselineValue}</li>
              <li>• delta: {deltaPercent}</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <ActionCallout
            label="Action"
            directive={command.root_cause.recommended_fix.summary}
            supporting={suggestedFix?.description}
            confidence="high"
            source="root-cause engine"
          />

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Mitigations</p>
            <div className="mt-2 space-y-2 text-sm text-steel">
              {command.recommended_mitigations.length > 0 ? (
                command.recommended_mitigations.slice(0, 4).map((item) => <p key={item}>{item}</p>)
              ) : (
                <p>No mitigations attached yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Deployment context</p>
            <div className="mt-2 space-y-2 text-sm text-steel">
              {command.deployment_context ? (
                <>
                  <p>{command.deployment_context.model_version?.model_name ?? "Model n/a"}</p>
                  <p>{command.deployment_context.prompt_version?.version ?? "Prompt n/a"}</p>
                  <p>{command.deployment_context.time_since_deployment_minutes} min before incident</p>
                </>
              ) : (
                <p>No deployment was linked to this incident.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
