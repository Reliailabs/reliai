"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, GitCompareArrows } from "lucide-react";

import type { IncidentDetailRead, TraceComparisonRead } from "@reliai/types";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface PromptDiffViewProps {
  incidentId: string;
  incident: IncidentDetailRead;
  comparison: TraceComparisonRead | null;
  activeTab: string;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "cohort-diff", label: "Cohort Diff" },
  { id: "prompt-diff", label: "Prompt Diff" },
  { id: "traces", label: "Affected Traces" },
] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inferChangeDriver(comparison: TraceComparisonRead) {
  const promptContexts = comparison.prompt_version_contexts;
  if (promptContexts.length === 0) {
    return {
      headline: "No prompt-version split was found for this incident window.",
      confidence: "low",
      note: "Compare still shows behavior deltas, but they are not concentrated on a single prompt version.",
    } as const;
  }

  const top = [...promptContexts].sort((a, b) => {
    const aDelta = (a.current_count ?? 0) - (a.baseline_count ?? 0);
    const bDelta = (b.current_count ?? 0) - (b.baseline_count ?? 0);
    return bDelta - aDelta;
  })[0];

  const delta = (top.current_count ?? 0) - (top.baseline_count ?? 0);
  const isLikely = delta > 0;

  return {
    headline: isLikely
      ? `Prompt ${top.version} increased in failing-window concentration.`
      : `Prompt ${top.version} did not increase versus baseline.`,
    confidence: isLikely ? "high" : "medium",
    note: isLikely
      ? `Current traces: ${top.current_count ?? 0} vs baseline: ${top.baseline_count ?? 0}.`
      : `Current traces: ${top.current_count ?? 0} vs baseline: ${top.baseline_count ?? 0}. Investigate model or retrieval shifts as primary drivers.`,
  } as const;
}

function summarizeDiffSignals(comparison: TraceComparisonRead) {
  const counts = new Map<string, number>();
  for (const pair of comparison.pairs) {
    for (const block of pair.diff_blocks) {
      if (!block.changed) continue;
      counts.set(block.title, (counts.get(block.title) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

interface PromptDiffApiLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

interface PromptDiffApiVersion {
  id: string;
  version: string;
  content: string;
  created_at?: string;
  createdAt?: string;
}

interface PromptDiffApiResponse {
  from_version?: PromptDiffApiVersion;
  to_version?: PromptDiffApiVersion;
  from?: PromptDiffApiVersion;
  to?: PromptDiffApiVersion;
  diff: PromptDiffApiLine[];
}

interface NormalizedPromptDiffApiResponse {
  from_version: PromptDiffApiVersion;
  to_version: PromptDiffApiVersion;
  diff: PromptDiffApiLine[];
}

function getVersionCreatedAt(version: PromptDiffApiVersion) {
  return version.created_at ?? version.createdAt ?? "";
}

function normalizePromptDiffResponse(payload: PromptDiffApiResponse): NormalizedPromptDiffApiResponse | null {
  const fromVersion = payload.from_version ?? payload.from;
  const toVersion = payload.to_version ?? payload.to;
  if (!fromVersion || !toVersion) {
    return null;
  }

  const normalizedDiff = (payload.diff || [])
    .filter((line) => typeof line?.text === "string")
    .map((line) => ({
      type: line.type === "added" || line.type === "removed" || line.type === "unchanged" ? line.type : "unchanged",
      text: line.text,
    }));

  return {
    from_version: fromVersion,
    to_version: toVersion,
    diff: normalizedDiff,
  };
}

function isUuidLike(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function deployedMinutesBeforeIncident(diff: PromptDiffApiResponse, incident: IncidentDetailRead) {
  const incidentStart = new Date(incident.started_at).getTime();
  const toVersion = diff.to_version ?? diff.to;
  if (!toVersion) {
    return null;
  }
  const deployedAt = new Date(getVersionCreatedAt(toVersion)).getTime();
  if (!Number.isFinite(incidentStart) || !Number.isFinite(deployedAt)) {
    return null;
  }
  return Math.round((incidentStart - deployedAt) / 60000);
}

function PromptTextDiff({ rows }: { rows: PromptDiffApiLine[] }) {
  return (
    <div className="max-h-[460px] overflow-auto rounded-[14px] border border-zinc-200 bg-zinc-950 p-3">
      <pre className="font-mono text-xs leading-5 text-zinc-100">
        {rows.map((row, index) => (
          <div
            key={`${row.type}-${index}`}
            className={cn(
              "whitespace-pre-wrap rounded px-2 py-0.5",
              row.type === "added" && "bg-emerald-900/40 text-emerald-200",
              row.type === "removed" && "bg-rose-900/35 text-rose-200",
              row.type === "unchanged" && "text-zinc-300"
            )}
          >
            <span className="mr-2 inline-block w-3 text-zinc-500">
              {row.type === "added" ? "+" : row.type === "removed" ? "-" : " "}
            </span>
            {row.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function PromptDiffView({ incidentId, incident, comparison, activeTab }: PromptDiffViewProps) {
  return (
    <div className="space-y-4">
      <header className="rounded-[20px] border border-zinc-300 bg-white px-5 py-4">
        <Link
          href={`/incidents/${incidentId}/command`}
          className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-ink">{incident.title}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600">
            {incident.severity}
          </span>
        </div>
      </header>

      <nav className="flex gap-1 rounded-[14px] border border-zinc-200 bg-zinc-50 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/incidents/${incidentId}/command?tab=${tab.id}`}
            className={cn(
              "rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-white text-ink shadow-sm" : "text-steel hover:text-ink"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {comparison === null ? (
        <section className="rounded-[18px] border border-zinc-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">We could not load prompt diff evidence.</p>
          <p className="mt-2 text-sm text-steel">Try reloading this tab or return to cohort diff.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/incidents/${incidentId}/command?tab=prompt-diff`}>Retry</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/incidents/${incidentId}/command?tab=cohort-diff`}>Return to Cohort Diff</Link>
            </Button>
          </div>
        </section>
      ) : (
        <PromptDiffEvidence incidentId={incidentId} incident={incident} comparison={comparison} />
      )}
    </div>
  );
}

function PromptDiffEvidence({
  incidentId,
  incident,
  comparison,
}: {
  incidentId: string;
  incident: IncidentDetailRead;
  comparison: TraceComparisonRead;
}) {
  const summary = incident.summary_json ?? {};
  const driver = inferChangeDriver(comparison);
  const topSignals = summarizeDiffSignals(comparison);
  const promptCandidates = useMemo(
    () => [...comparison.prompt_version_contexts].slice(0, 2),
    [comparison.prompt_version_contexts]
  );
  const fromVersionId = promptCandidates[1]?.id ?? null;
  const toVersionId = promptCandidates[0]?.id ?? null;
  const [diffData, setDiffData] = useState<NormalizedPromptDiffApiResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("prompt_diff_viewed", {
      incident_id: incidentId,
      prompt_context_count: comparison.prompt_version_contexts.length,
    });
  }, [incidentId, comparison.prompt_version_contexts.length]);

  useEffect(() => {
    if (!isUuidLike(fromVersionId) || !isUuidLike(toVersionId)) {
      setDiffData(null);
      setDiffError("Not enough prompt versions are available to compute a diff.");
      return;
    }

    const controller = new AbortController();
    async function run() {
      setLoadingDiff(true);
      setDiffError(null);
      try {
        const response = await fetch(
          `/api/prompts/diff?fromVersionId=${encodeURIComponent(fromVersionId)}&toVersionId=${encodeURIComponent(toVersionId)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (response.status === 401) {
          throw new Error("Your session expired. Refresh and sign in again.");
        }
        if (!response.ok) {
          throw new Error(`Prompt diff failed (${response.status})`);
        }
        const json = (await response.json()) as PromptDiffApiResponse;
        const normalized = normalizePromptDiffResponse(json);
        if (!normalized) {
          throw new Error("Prompt diff response was missing required version data.");
        }
        setDiffData(normalized);
      } catch (error) {
        if (!controller.signal.aborted) {
          setDiffData(null);
          setDiffError(error instanceof Error ? error.message : "Prompt diff request failed");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDiff(false);
        }
      }
    }
    run();

    return () => controller.abort();
  }, [fromVersionId, toVersionId]);

  const deployedMinutes = diffData ? deployedMinutesBeforeIncident(diffData, incident) : null;

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[18px] border border-zinc-200 bg-white px-5 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Prompt evidence summary</p>
          <h2 className="mt-3 text-xl font-semibold text-ink">
            {diffData
              ? `Prompt ${diffData.to_version.version} vs ${diffData.from_version.version}`
              : "Prompt version impact on this incident"}
          </h2>
          <p className="mt-2 text-sm text-steel">{driver.headline}</p>
          <p className="mt-2 text-sm text-steel">{driver.note}</p>
          {diffData ? (
            <p className="mt-2 text-sm text-steel">
              {deployedMinutes !== null
                ? `Deployed ${deployedMinutes} minutes before incident start.`
                : "Deployment timing could not be derived for this prompt pair."}
            </p>
          ) : null}
          <div className="mt-4 flex items-center gap-2">
            {driver.confidence === "high" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <span className="text-xs uppercase tracking-[0.14em] text-steel">
              Confidence: {driver.confidence}
            </span>
          </div>
        </div>

        <div className="rounded-[18px] border border-zinc-200 bg-white px-5 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Change timing</p>
          <div className="mt-3 space-y-2 text-sm text-steel">
            <p>
              Incident started: <span className="font-medium text-ink">{formatDateTime(incident.started_at)}</span>
            </p>
            <p>
              Current window: <span className="font-medium text-ink">{formatDateTime(comparison.current_window_start)}</span>
              {" "}- {formatDateTime(comparison.current_window_end)}
            </p>
            <p>
              Baseline window: <span className="font-medium text-ink">{formatDateTime(comparison.baseline_window_start)}</span>
              {" "}- {formatDateTime(comparison.baseline_window_end)}
            </p>
            {typeof summary.metric_name === "string" ? (
              <p>
                Triggered signal: <span className="font-medium text-ink">{summary.metric_name}</span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-zinc-200 bg-white px-5 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-steel">Line-level prompt diff</p>
        {loadingDiff ? (
          <div className="mt-4 rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-steel">
            Loading prompt diff...
          </div>
        ) : null}
        {!loadingDiff && diffError ? (
          <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {diffError}
          </div>
        ) : null}
        {!loadingDiff && !diffError && diffData && diffData.diff.length === 0 ? (
          <div className="mt-4 rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-steel">
            Prompt text has no line-level changes.
          </div>
        ) : null}
        {!loadingDiff && !diffError && diffData && diffData.diff.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 text-xs text-steel sm:grid-cols-2">
              <p>
                From <span className="font-semibold text-ink">{diffData.from_version.version}</span> · {formatDateTime(getVersionCreatedAt(diffData.from_version))}
              </p>
              <p>
                To <span className="font-semibold text-ink">{diffData.to_version.version}</span> · {formatDateTime(getVersionCreatedAt(diffData.to_version))}
              </p>
            </div>
            <PromptTextDiff rows={diffData.diff} />
          </div>
        ) : null}
      </section>

      <section className="rounded-[18px] border border-zinc-200 bg-white px-5 py-5">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-steel" />
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Prompt version distribution</p>
        </div>

        {comparison.prompt_version_contexts.length === 0 ? (
          <div className="mt-4 rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-steel">
            No prompt version contexts were attached to these traces.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.16em] text-steel">Prompt</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.16em] text-steel">Current</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.16em] text-steel">Baseline</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.16em] text-steel">Delta</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.16em] text-steel">Pivots</th>
                </tr>
              </thead>
              <tbody>
                {comparison.prompt_version_contexts.map((context) => {
                  const current = context.current_count ?? 0;
                  const baseline = context.baseline_count ?? 0;
                  const delta = current - baseline;
                  return (
                    <tr key={context.id} className="border-b border-zinc-50">
                      <td className="px-3 py-2 font-medium text-ink">{context.version}</td>
                      <td className="px-3 py-2 text-steel">{current}</td>
                      <td className="px-3 py-2 text-steel">{baseline}</td>
                      <td className="px-3 py-2">
                        <span className={cn("text-xs font-semibold", delta > 0 ? "text-rose-700" : "text-emerald-700")}>
                          {delta > 0 ? `+${delta}` : `${delta}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-wrap gap-2">
                          <a href={context.traces_path} className="text-ink underline-offset-4 hover:underline">
                            Traces
                          </a>
                          <a href={context.incidents_path} className="text-ink underline-offset-4 hover:underline">
                            Incidents
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[18px] border border-zinc-200 bg-white px-5 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-steel">Behavior deltas tied to this incident</p>
        {topSignals.length === 0 ? (
          <p className="mt-3 text-sm text-steel">No changed signal blocks were detected between current and baseline traces.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {topSignals.map(([title, count]) => (
              <div key={title} className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">Changed in {count} trace pairs</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          <Link href={`/incidents/${incidentId}/command?tab=cohort-diff`}>Return to Cohort Diff</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/incidents/${incidentId}`}>Back to Incident</Link>
        </Button>
      </section>
    </>
  );
}