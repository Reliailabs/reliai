import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { IncidentCommandCenterRead } from "@reliai/types";

import { ActionCallout } from "@/components/ui/action-callout";
import { RecommendationCallout } from "@/components/ui/recommendation-callout";
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
  activeTab?: string;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "cohort-diff", label: "Cohort Diff" },
  { id: "prompt-diff", label: "Prompt Diff" },
  { id: "traces", label: "Affected Traces" },
] as const;

function formatKey(key: string) {
  return key.replaceAll("_", " ");
}

function formatPrimitive(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function formatObjectLines(prefix: string, value: Record<string, unknown>) {
  const lines: string[] = [];
  Object.entries(value).forEach(([childKey, childValue]) => {
    if (childValue === null || childValue === undefined) return;
    if (Array.isArray(childValue)) {
      childValue.forEach((item) => {
        const primitive = formatPrimitive(item);
        if (primitive !== null) {
          lines.push(`${formatKey(prefix)} ${formatKey(childKey)}: ${primitive}`);
        } else if (item && typeof item === "object") {
          const compact = Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => {
              const vPrimitive = formatPrimitive(v);
              return vPrimitive ? `${formatKey(k)}=${vPrimitive}` : null;
            })
            .filter(Boolean)
            .join(", ");
          if (compact) {
            lines.push(`${formatKey(prefix)} ${formatKey(childKey)}: ${compact}`);
          } else {
            lines.push(`${formatKey(prefix)} ${formatKey(childKey)}: ${JSON.stringify(item)}`);
          }
        }
      });
      return;
    }
    const primitive = formatPrimitive(childValue);
    if (primitive !== null) {
      lines.push(`${formatKey(prefix)} ${formatKey(childKey)}: ${primitive}`);
      return;
    }
    if (childValue && typeof childValue === "object") {
      const compact = Object.entries(childValue as Record<string, unknown>)
        .map(([k, v]) => {
          const vPrimitive = formatPrimitive(v);
          return vPrimitive ? `${formatKey(k)}=${vPrimitive}` : null;
        })
        .filter(Boolean)
        .join(", ");
      if (compact) {
        lines.push(`${formatKey(prefix)} ${formatKey(childKey)}: ${compact}`);
      } else {
        lines.push(`${formatKey(prefix)} ${formatKey(childKey)}: ${JSON.stringify(childValue)}`);
      }
    }
  });
  return lines;
}

function formatEvidence(evidence: Record<string, unknown> | null): string[] {
  if (!evidence) return [];
  return Object.entries(evidence).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        const primitive = formatPrimitive(item);
        if (primitive !== null) {
          return `${formatKey(key)}: ${primitive}`;
        }
        if (item && typeof item === "object") {
          return formatObjectLines(formatKey(key), item as Record<string, unknown>);
        }
        return [];
      });
    }
    const primitive = formatPrimitive(value);
    if (primitive !== null) {
      return `${formatKey(key)}: ${primitive}`;
    }
    if (value && typeof value === "object") {
      const compact = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => {
          const vPrimitive = formatPrimitive(v);
          return vPrimitive ? `${formatKey(k)}=${vPrimitive}` : null;
        })
        .filter(Boolean)
        .join(", ");
      if (compact) {
        return `${formatKey(key)}: ${compact}`;
      }
      return formatObjectLines(formatKey(key), value as Record<string, unknown>);
    }
    return [];
  });
}

function formatImpactValue(value: number | null | undefined, unit: string | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  if (unit === "%") return `${value}%`;
  if (unit === "ms") return `${value}ms`;
  if (unit) return `${value}${unit}`;
  return String(value);
}

export function IncidentCommandCenterView({
  incidentId,
  command,
  suggestedFix = null,
  screenshotMode = false,
  activeTab = "overview",
}: IncidentCommandCenterViewProps) {
  const incident = command.incident;
  const summary = incident.summary_json ?? {};
  const metric = command.metric ?? null;
  const metricName = metric?.display_name ?? metric?.metric_name ?? String(summary.metric_name ?? "metric");
  const metricUnit = metric?.unit ?? null;
  const currentValue = metric?.value ?? (summary.current_value ? String(summary.current_value) : "n/a");
  const baselineValue = metric?.baseline_value ?? (summary.baseline_value ? String(summary.baseline_value) : "n/a");
  const deltaPercent = metric?.delta_percent ?? (summary.delta_percent ? String(summary.delta_percent) : "n/a");
  const resolutionImpact = command.resolution_impact ?? null;
  const compareLink = command.trace_compare.compare_link
    ? (command.trace_compare.compare_link.includes("?")
      ? `${command.trace_compare.compare_link}&incident_id=${incidentId}`
      : `${command.trace_compare.compare_link}?incident_id=${incidentId}`)
    : null;

  const metricSignals: Array<{ label: string; value: string }> = [];
  if (metric) {
    metricSignals.push({
      label: metricName,
      value: `${currentValue}${metricUnit ? ` ${metricUnit}` : ""}`,
    });
    if (baselineValue !== "n/a") {
      metricSignals.push({
        label: "baseline",
        value: `${baselineValue}${metricUnit ? ` ${metricUnit}` : ""}`,
      });
    }
    if (deltaPercent !== "n/a") {
      metricSignals.push({ label: "delta", value: `${deltaPercent}%` });
    }
  } else if (metricName) {
    metricSignals.push({ label: metricName, value: String(currentValue) });
  }

  const rootCauseTitle =
    command.root_cause.root_cause_probabilities[0]?.label ?? "No dominant root cause yet";
  const evidenceLines = formatEvidence(command.root_cause.evidence);
  const maxEvidenceLines = 14;
  const extraEvidenceCount =
    evidenceLines.length > maxEvidenceLines ? evidenceLines.length - maxEvidenceLines : 0;
  const visibleEvidence = extraEvidenceCount > 0
    ? evidenceLines.slice(0, maxEvidenceLines)
    : evidenceLines;
  const rootCauseProbability =
    command.root_cause.top_root_cause_probability ??
    command.root_cause.root_cause_probabilities[0]?.probability ??
    null;
  const recommendationKind =
    command.root_cause.recommendation_kind ??
    (typeof rootCauseProbability === "number" && rootCauseProbability >= 0.8 ? "action" : "recommendation");
  const supportingText =
    command.root_cause.recommended_action_reason ??
    (rootCauseProbability !== null
      ? `Root cause confidence ${Math.round(rootCauseProbability * 100)}% based on trace deltas.`
      : "Root cause signal is based on current trace deltas.");
  const showRefusalMetricCta = incident.incident_type === "refusal_rate_spike";

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
          {metricSignals.map((signal) => (
            <div key={signal.label} className="flex items-center gap-2">
              <span className="uppercase tracking-[0.2em] text-steel">{signal.label}</span>
              <span className="text-ink">{signal.value}</span>
            </div>
          ))}
        </div>
      </header>

      {!screenshotMode ? (
        <nav className="flex gap-1 rounded-[14px] border border-zinc-200 bg-zinc-50 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/incidents/${incidentId}/command?tab=${tab.id}`}
              className={cn(
                "rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-white text-ink shadow-sm"
                  : "text-steel hover:text-ink"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="space-y-4">
          {incident.incident_type === "refusal_rate_spike" ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Refusal Rate Spike</p>
              <p className="mt-2 text-sm font-semibold text-rose-900">
                {currentValue !== "n/a" ? `Refusal rate: ${currentValue}${metricUnit ? ` ${metricUnit}` : ""}` : "Refusal rate elevated above baseline"}
              </p>
              {baselineValue !== "n/a" ? (
                <p className="mt-1 text-sm text-rose-700">
                  Baseline was {baselineValue}
                  {deltaPercent !== "n/a" ? ` · ${deltaPercent}% change` : ""}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-rose-700">
                Model outputs are matching known refusal phrases more frequently than the baseline window. Check the prompt diff for recent system prompt changes.
              </p>
            </div>
          ) : null}

          {showRefusalMetricCta ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50/60 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Behavioral signal</p>
              <p className="mt-2 text-sm font-semibold text-amber-900">
                Track this behavior as a metric
              </p>
              <p className="mt-2 text-sm text-amber-800">
                Turn refusal spikes into a persistent metric visible in Reliability and incidents.
              </p>
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link href={`/projects/${incident.project_id}/metrics?template=refusal_language&source=incident&incident_id=${incident.id}`}>
                    Create refusal metric
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {incident.incident_type.startsWith("custom_metric_spike") ? (() => {
            const customMetricName = String(summary.custom_metric_name ?? "Custom metric");
            const currentPct = currentValue !== "n/a" ? Math.round(Number(currentValue) * 100) : null;
            const baselinePct = baselineValue !== "n/a" ? Math.round(Number(baselineValue) * 100) : null;
            return (
              <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-600">{customMetricName} Spike</p>
                <p className="mt-2 text-sm font-semibold text-amber-900">
                  {currentPct !== null
                    ? `${currentPct}% of traces matched this pattern${baselinePct !== null ? ` (baseline: ${baselinePct}%)` : ""}`
                    : `${customMetricName} rate elevated above baseline`}
                </p>
                {deltaPercent !== "n/a" ? (
                  <p className="mt-1 text-sm text-amber-700">
                    {deltaPercent}% change from baseline
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-amber-700">
                  This indicates increased occurrence of:{" "}
                  <span className="font-medium">{customMetricName}</span>.
                  Review recent prompt or model changes.
                </p>
              </div>
            );
          })() : null}

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Root cause</p>
            <p className="mt-2 text-sm font-semibold text-ink">{rootCauseTitle}</p>
            {rootCauseProbability !== null ? (
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-steel">
                Confidence: {Math.round(rootCauseProbability * 100)}%
              </p>
            ) : null}
            <p className="mt-2 text-sm text-steel">{command.root_cause.recommended_fix.summary}</p>
            {command.root_cause.recommended_action_reason ? (
              <p className="mt-2 text-sm text-ink">{command.root_cause.recommended_action_reason}</p>
            ) : null}
            {visibleEvidence.length > 0 ? (
              <ul className="mt-3 text-xs text-steel">
                {visibleEvidence.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
                {extraEvidenceCount > 0 ? (
                  <li className="text-steel">+{extraEvidenceCount} more</li>
                ) : null}
              </ul>
            ) : null}
          </div>

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Trace evidence</p>
            <p className="mt-2 text-sm text-steel">Top failing trace is ready for review.</p>
            {!screenshotMode ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/incidents/${incidentId}/command?tab=cohort-diff`}>
                    Open cohort diff
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/incidents/${incidentId}/command?tab=prompt-diff`}>
                    View prompt diff
                  </Link>
                </Button>
                {compareLink ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={compareLink}>Open example trace</a>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {resolutionImpact ? (
            <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-steel">Resolution impact</p>
              {resolutionImpact.summary ? (
                <p className="mt-2 text-sm font-semibold text-ink">{resolutionImpact.summary}</p>
              ) : (
                <p className="mt-2 text-sm text-steel">Waiting for post-fix data.</p>
              )}
              <ul className="mt-2 text-sm text-steel">
                <li>
                  • before: {formatImpactValue(resolutionImpact.before_value, resolutionImpact.unit)}
                </li>
                {resolutionImpact.after_value !== null && resolutionImpact.after_value !== undefined ? (
                  <li>
                    • after: {formatImpactValue(resolutionImpact.after_value, resolutionImpact.unit)}
                  </li>
                ) : null}
                {resolutionImpact.delta !== null && resolutionImpact.delta !== undefined ? (
                  <li>
                    • delta: {formatImpactValue(resolutionImpact.delta, resolutionImpact.unit)}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="rounded-[18px] border border-zinc-300 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Impact</p>
            <ul className="mt-2 text-sm text-steel">
              <li>• current value: {currentValue}</li>
              <li>• baseline value: {baselineValue}</li>
              <li>• delta: {deltaPercent !== "n/a" ? `${deltaPercent}%` : "n/a"}</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {recommendationKind === "action" ? (
            <ActionCallout
              label="Action"
              directive={command.root_cause.recommended_fix.summary}
              supporting={supportingText}
              confidence="high"
              source="root-cause engine"
            />
          ) : (
            <RecommendationCallout
              label="Recommendation"
              recommendation={command.root_cause.recommended_fix.summary}
              supporting={supportingText}
            />
          )}

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
