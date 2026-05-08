"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import type { AiFixPrSummaryRequest, AiFixPrSummaryResponse } from "@reliai/types";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DocsLink } from "@/components/docs/docs-link";
import { formatTime } from "@/components/presenters/ops-format";
import { useLimitStatus } from "@/hooks/use-limit-status";

type SummaryStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiFixSummaryModalProps {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  incidentUpdatedAt: string | null;
  projectId?: string | null;
  generateSummary: (payload: AiFixPrSummaryRequest) => Promise<AiFixPrSummaryResponse>;
}

function buildFullSummary(
  title: string,
  summary: string,
  changeApplied: string,
  impactObserved: string,
  evidence: string[],
): string {
  const sections: string[] = [];
  if (title) sections.push(title);
  if (summary) {
    sections.push("");
    sections.push("Summary:");
    sections.push(summary);
  }
  if (changeApplied) {
    sections.push("");
    sections.push("Change Applied:");
    sections.push(changeApplied);
  }
  if (impactObserved) {
    sections.push("");
    sections.push("Impact Observed:");
    sections.push(impactObserved);
  }
  if (evidence.length > 0) {
    sections.push("");
    sections.push("Based on:");
    for (const line of evidence) {
      sections.push(`- ${line}`);
    }
  }
  return sections.join("\n");
}

const INSUFFICIENT_EVIDENCE_BULLETS = [
  "No fix or config action recorded yet",
  "Awaiting post-fix evidence",
  "Awaiting resolution impact data",
];

export function AiFixSummaryModal({
  open,
  onClose,
  incidentId,
  incidentUpdatedAt,
  projectId,
  generateSummary,
}: AiFixSummaryModalProps) {
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [result, setResult] = useState<AiFixPrSummaryResponse | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { byType } = useLimitStatus(projectId ?? undefined);
  const providerLimits = byType.llm_provider ?? [];
  const processorLimits = byType.processor_dispatch ?? [];
  const isProviderLimited = providerLimits.some((limit) => limit.scope?.feature === "ai_fix_summary");
  const isProcessorDelayed = processorLimits.length > 0;

  const resetState = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setCopiedSummary(false);
    setCopiedFull(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const fetchSummary = useCallback((override?: Partial<AiFixPrSummaryRequest>) => {
    setCopiedSummary(false);
    setCopiedFull(false);
    setStatus("loading");
    startTransition(() => {
      generateSummary({ ...(override ?? {}) })
        .then((response) => {
          setResult(response);
          if (response.status === "ok") {
            setStatus("ready");
            if (response.generated_at) {
              setLastSuccessAt(response.generated_at);
            }
            return;
          }
          if (response.status === "error") {
            setStatus("error");
            return;
          }
          setStatus("insufficient");
        })
        .catch((_error: unknown) => {
          setStatus("error");
        });
    });
  }, [generateSummary]);

  useEffect(() => {
    if (!open) return;
    fetchSummary();
  }, [open, incidentId, fetchSummary]);

  if (!open) return null;

  const isLoading = status === "loading" || isPending;
  const evidence = result?.evidence_used ?? [];
  const generatedAt = result?.generated_at ?? null;
  const isStale =
    generatedAt && incidentUpdatedAt
      ? new Date(generatedAt).getTime() < new Date(incidentUpdatedAt).getTime()
      : false;

  function copyText(text: string, set: (value: boolean) => void) {
    void navigator.clipboard?.writeText(text).then(() => {
      set(true);
      setTimeout(() => set(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-zinc-200 bg-white shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-5">
          <div>
            <p className="text-xl font-semibold text-zinc-950">Draft Fix Summary</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Built from fix event and incident evidence. Review before sharing.
            </p>
            <DocsLink href="/docs/ai" label="How AI works in Reliai" variant="light" />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
              Draft
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isProcessorDelayed ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Queued — generation is delayed.
            </div>
          ) : null}

          {isProviderLimited ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>Provider limit hit — try again shortly.</p>
              {lastSuccessAt ? (
                <p className="mt-1 text-[11px] text-amber-800/90">
                  Last successful generation: {formatTime(lastSuccessAt)}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Loading skeleton */}
          {isLoading ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
                <div className="h-8 w-full animate-pulse rounded-xl bg-zinc-100" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 space-y-2">
                <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ) : null}

          {/* Ready */}
          {status === "ready" && result ? (
            <div className="space-y-5">

              {/* Title */}
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Title</p>
                <p className="mt-1 text-base font-semibold text-zinc-900">{result.title}</p>
              </div>

              {/* Summary */}
              {result.summary ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Summary</p>
                  <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-sm leading-6 text-zinc-800">{result.summary}</p>
                  </div>
                </div>
              ) : null}

              {/* Change applied */}
              {result.change_applied ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Change Applied</p>
                  <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-sm leading-6 text-zinc-800">{result.change_applied}</p>
                  </div>
                </div>
              ) : null}

              {/* Impact observed */}
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Impact Observed</p>
                <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-sm leading-6 text-zinc-800">
                    {result.impact_observed ?? "Post-fix impact not yet verified."}
                  </p>
                </div>
              </div>

              {/* Evidence */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
                <ul className="mt-2 space-y-1">
                  {evidence.map((item) => (
                    <li key={item} className="text-sm text-zinc-700">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {/* Insufficient evidence */}
          {status === "insufficient" ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-700">
                There isn&apos;t enough evidence yet to draft a fix summary. A fix or config action must be recorded first.
              </p>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
                <ul className="mt-2 space-y-1">
                  {(evidence.length > 0 ? evidence : INSUFFICIENT_EVIDENCE_BULLETS).map((item) => (
                    <li key={item} className="text-sm text-zinc-500">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {/* Error */}
          {status === "error" ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">AI fix summary unavailable right now.</p>
              <Button size="sm" variant="outline" onClick={() => fetchSummary()}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>

        {/* ── Stale strip ────────────────────────────────────────── */}
        {isStale && !isLoading ? (
          <div className="shrink-0 px-6 pb-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Summary may be outdated — incident evidence changed since generation.
            </div>
          </div>
        ) : null}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
          <span className="text-xs text-zinc-500">
            {generatedAt ? `Generated ${formatTime(generatedAt)}` : "Generated time unavailable"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="subtle"
              disabled={status !== "ready" || !result?.summary}
              onClick={() => {
                if (!result?.summary) return;
                copyText(result.summary, setCopiedSummary);
              }}
            >
              {copiedSummary ? "Copied" : "Copy summary"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              disabled={status !== "ready"}
              onClick={() => {
                if (!result) return;
                copyText(
                  buildFullSummary(
                    result.title ?? "",
                    result.summary ?? "",
                    result.change_applied ?? "",
                    result.impact_observed ?? "Post-fix impact not yet verified.",
                    evidence,
                  ),
                  setCopiedFull,
                );
              }}
            >
              {copiedFull ? "Copied" : "Copy full draft"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              disabled={isLoading}
              onClick={() => fetchSummary({ regenerate: true })}
              className={cn(isStale && "border-amber-200 text-amber-700 hover:bg-amber-50")}
            >
              Regenerate
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
