"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, X } from "lucide-react";

import type { IncidentDetailRead, TraceComparisonRead, TraceComparePairRead, TraceDiffBlockRead } from "@reliai/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CohortDiffViewProps {
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

type SortKey = "confidence" | "latest" | "prompt_version";
type SignalFilter = "all" | "failures" | "structured_output" | "latency";

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function failureSignal(pair: TraceComparePairRead): string | null {
  const t = pair.current_trace;
  if (!t) return null;
  if (!t.success) return t.error_type ?? "failure";
  const so = pair.diff_blocks.find((b) => b.block_type === "structured_output" && b.changed);
  if (so) return "structured output";
  const perf = pair.diff_blocks.find((b) => b.block_type === "performance" && b.changed);
  if (perf) return "latency spike";
  return null;
}

function changedBlocks(pair: TraceComparePairRead): TraceDiffBlockRead[] {
  return pair.diff_blocks.filter((b) => b.changed);
}

function filterAndSort(
  pairs: TraceComparePairRead[],
  signal: SignalFilter,
  sort: SortKey
): TraceComparePairRead[] {
  let filtered = pairs;
  if (signal === "failures") {
    filtered = pairs.filter((p) => p.current_trace && !p.current_trace.success);
  } else if (signal === "structured_output") {
    filtered = pairs.filter((p) =>
      p.diff_blocks.some((b) => b.block_type === "structured_output" && b.changed)
    );
  } else if (signal === "latency") {
    filtered = pairs.filter((p) =>
      p.diff_blocks.some((b) => b.block_type === "performance" && b.changed)
    );
  }

  if (sort === "confidence") {
    filtered = [...filtered].sort((a, b) => {
      const aFail = a.current_trace?.success === false ? 0 : 1;
      const bFail = b.current_trace?.success === false ? 0 : 1;
      return aFail - bFail;
    });
  } else if (sort === "latest") {
    filtered = [...filtered].sort((a, b) => {
      const aTs = a.current_trace?.timestamp ?? "";
      const bTs = b.current_trace?.timestamp ?? "";
      return bTs.localeCompare(aTs);
    });
  } else if (sort === "prompt_version") {
    filtered = [...filtered].sort((a, b) => {
      const av = a.current_trace?.prompt_version ?? "";
      const bv = b.current_trace?.prompt_version ?? "";
      return av.localeCompare(bv);
    });
  }

  return filtered;
}

function TracePairDrawer({
  pair,
  onClose,
}: {
  pair: TraceComparePairRead;
  onClose: () => void;
}) {
  const current = pair.current_trace;
  const baseline = pair.baseline_trace;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-secondary">Trace pair #{pair.pair_index + 1}</p>
            {current ? (
              <p className="mt-1 font-mono text-sm text-primary">{shortId(current.id)}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-secondary transition hover:bg-zinc-100 hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Output comparison */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-secondary">Output comparison</p>
            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-rose-600">Failing</p>
                {current ? (
                  <div className="space-y-1 text-sm text-secondary">
                    <p><span className="font-medium text-primary">model:</span> {current.model_name}</p>
                    {current.prompt_version ? (
                      <p><span className="font-medium text-primary">prompt:</span> {current.prompt_version}</p>
                    ) : null}
                    <p><span className="font-medium text-primary">success:</span>{" "}
                      <span className={current.success ? "text-emerald-600" : "text-rose-600"}>
                        {current.success ? "yes" : "no"}
                      </span>
                    </p>
                    {current.error_type ? (
                      <p><span className="font-medium text-primary">error:</span> {current.error_type}</p>
                    ) : null}
                    {current.latency_ms ? (
                      <p><span className="font-medium text-primary">latency:</span> {current.latency_ms}ms</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-secondary">No current trace</p>
                )}
              </div>
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-emerald-600">Baseline</p>
                {baseline ? (
                  <div className="space-y-1 text-sm text-secondary">
                    <p><span className="font-medium text-primary">model:</span> {baseline.model_name}</p>
                    {baseline.prompt_version ? (
                      <p><span className="font-medium text-primary">prompt:</span> {baseline.prompt_version}</p>
                    ) : null}
                    <p><span className="font-medium text-primary">success:</span>{" "}
                      <span className={baseline.success ? "text-emerald-600" : "text-rose-600"}>
                        {baseline.success ? "yes" : "no"}
                      </span>
                    </p>
                    {baseline.latency_ms ? (
                      <p><span className="font-medium text-primary">latency:</span> {baseline.latency_ms}ms</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-secondary">No baseline trace matched</p>
                )}
              </div>
            </div>
          </div>

          {/* Diff blocks */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-secondary">Signal breakdown</p>
            <div className="space-y-2">
              {pair.diff_blocks.map((block) => (
                <div
                  key={block.block_type}
                  className={cn(
                    "rounded-[12px] border px-4 py-3",
                    block.changed
                      ? "border-amber-200 bg-amber-50"
                      : "border-zinc-200 bg-zinc-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-primary">{block.title}</p>
                    {block.changed ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                        changed
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">
                        same
                      </span>
                    )}
                  </div>
                  {(block.current_value || block.baseline_value) ? (
                    <div className="mt-2 grid gap-2 text-xs text-secondary sm:grid-cols-2">
                      {block.current_value ? (
                        <div>
                          <span className="font-medium text-rose-600">failing: </span>
                          {block.current_value}
                        </div>
                      ) : null}
                      {block.baseline_value ? (
                        <div>
                          <span className="font-medium text-emerald-600">baseline: </span>
                          {block.baseline_value}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Structured output */}
          {current?.structured_output ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-secondary">Structured output</p>
              <div className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-secondary">
                <p><span className="font-medium text-primary">label:</span> {current.structured_output.label ?? "n/a"}</p>
                {current.structured_output.reason ? (
                  <p className="mt-1"><span className="font-medium text-primary">reason:</span> {current.structured_output.reason}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 px-6 py-4 flex gap-3">
          {current ? (
            <Button asChild size="sm">
              <Link href={`/traces/${current.id}`}>Open full trace</Link>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </>
  );
}

export function CohortDiffView({ incidentId, incident, comparison, activeTab }: CohortDiffViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");
  const [openPair, setOpenPair] = useState<TraceComparePairRead | null>(null);

  const pairs = comparison?.pairs ?? [];
  const failingCount = comparison?.current_traces.length ?? 0;
  const baselineCount = comparison?.baseline_traces.length ?? 0;

  // Derive top changed signal from dimension_summaries
  const topDimension = comparison?.dimension_summaries.find((d) => d.delta_value !== null);
  const topSignalLabel = topDimension
    ? `${topDimension.dimension}: ${topDimension.current_value ?? "n/a"} (was ${topDimension.baseline_value ?? "n/a"})`
    : "No dominant signal";

  const topPromptContext = comparison?.prompt_version_contexts[0];
  const topDriverLabel = topPromptContext
    ? `Prompt v${topPromptContext.version}`
    : comparison?.model_version_contexts[0]?.model_name ?? "Unknown";

  const displayPairs = filterAndSort(pairs, signalFilter, sortKey);

  const SIGNAL_FILTERS: { key: SignalFilter; label: string }[] = [
    { key: "all", label: "All signals" },
    { key: "failures", label: "Failures" },
    { key: "structured_output", label: "Structured output" },
    { key: "latency", label: "Latency" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="rounded-[20px] border border-zinc-300 bg-white px-5 py-4">
        <Link
          href={`/incidents/${incidentId}/command`}
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-primary">{incident.title}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600">
            {incident.severity}
          </span>
        </div>
      </header>

      {/* Tab nav */}
        <nav className="flex gap-1 rounded-[14px] border border-default bg-surface-elevated p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/incidents/${incidentId}/command?tab=${tab.id}`}
              className={cn(
                "rounded-[10px] border border-transparent px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "tab-active border-default"
                  : "tab-inactive hover:border-default"
              )}
            >
              {tab.label}
            </Link>
          ))}
      </nav>

      {comparison === null ? (
        <div className="rounded-[18px] border border-zinc-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-primary">Could not load cohort comparison</p>
          <p className="mt-2 text-sm text-secondary">Try refreshing the page.</p>
          <div className="mt-4">
            <Button asChild size="sm" variant="outline">
              <Link href={`/incidents/${incidentId}/command?tab=cohort-diff`}>Retry</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Failing traces", value: String(failingCount) },
              { label: "Baseline traces", value: String(baselineCount) },
              { label: "Top changed signal", value: topDimension?.dimension ?? "n/a" },
              { label: "Most likely driver", value: topDriverLabel },
            ].map((card) => (
              <div key={card.label} className="rounded-[16px] border border-zinc-200 bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-secondary">{card.label}</p>
                <p className="mt-2 truncate text-lg font-semibold text-primary" title={card.value}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Controls bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-secondary">Sort</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-primary focus:outline-none"
              >
                <option value="confidence">Highest failure confidence</option>
                <option value="latest">Latest first</option>
                <option value="prompt_version">Prompt version</option>
              </select>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2">
              {SIGNAL_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSignalFilter(f.key)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    signalFilter === f.key
                      ? "bg-ink text-white"
                      : "border border-zinc-200 bg-white text-secondary hover:border-zinc-300 hover:text-primary"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {topSignalLabel !== "No dominant signal" ? (
              <span className="ml-auto text-xs text-secondary">{topSignalLabel}</span>
            ) : null}
          </div>

          {/* Comparison table */}
          {displayPairs.length === 0 ? (
            <div className="rounded-[18px] border border-zinc-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-primary">No matched baseline traces found</p>
              <p className="mt-2 text-sm text-secondary">
                Try changing the baseline window or removing filters.
              </p>
              <div className="mt-4">
                <Button size="sm" variant="outline" onClick={() => setSignalFilter("all")}>
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-[18px] border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-secondary font-medium">Trace ID</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-secondary font-medium">Prompt version</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-secondary font-medium">Changed signals</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-secondary font-medium">Failure signal</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-secondary font-medium">Time</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.18em] text-secondary font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPairs.map((pair) => {
                    const current = pair.current_trace;
                    const signal = failureSignal(pair);
                    const changed = changedBlocks(pair);
                    return (
                      <tr
                        key={pair.pair_index}
                        className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-primary">
                            {current ? shortId(current.id) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {current?.prompt_version ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {changed.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {changed.slice(0, 3).map((b) => (
                                <span
                                  key={b.block_type}
                                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                                >
                                  {b.title}
                                </span>
                              ))}
                              {changed.length > 3 ? (
                                <span className="text-xs text-secondary">+{changed.length - 3}</span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-secondary">none</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {signal ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                              {signal}
                            </span>
                          ) : (
                            <span className="text-xs text-secondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary">
                          {current ? formatTime(current.timestamp) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setOpenPair(pair)}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-secondary transition hover:border-zinc-300 hover:text-primary"
                          >
                            Expand
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom CTAs */}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm" variant="outline">
              <Link href={`/incidents/${incidentId}/command?tab=prompt-diff`}>
                View prompt diff
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/incidents/${incidentId}`}>Back to incident</Link>
            </Button>
          </div>
        </>
      )}

      {/* Drawer */}
      {openPair ? (
        <TracePairDrawer pair={openPair} onClose={() => setOpenPair(null)} />
      ) : null}
    </div>
  );
}
