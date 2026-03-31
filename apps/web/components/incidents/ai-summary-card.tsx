"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type { AiIncidentSummaryRequest, AiIncidentSummaryResponse } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/presenters/ops-format";
import { useLimitStatus } from "@/hooks/use-limit-status";
import { cn } from "@/lib/utils";

type AiSummaryStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiSummaryCardProps {
  incidentId: string;
  projectId?: string | null;
  incidentUpdatedAt: string | null;
  generateSummary: (payload: AiIncidentSummaryRequest) => Promise<AiIncidentSummaryResponse>;
}

function buildCopy(summary: AiIncidentSummaryResponse) {
  if (summary.status === "error") {
    return "AI Summary\n\nAI summary unavailable right now.";
  }
  if (summary.status !== "ok") {
    return "AI Summary\n\nThere isn’t enough evidence yet to generate a reliable summary.";
  }
  const evidence = summary.evidence_used.map((item) => `- ${item}`).join("\n");
  return [
    "AI Summary",
    summary.summary ?? "",
    `Recommended next step: ${summary.recommended_next_step ?? "n/a"}`,
    "Based on:",
    evidence,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function AiSummaryCard({ incidentId, projectId, incidentUpdatedAt, generateSummary }: AiSummaryCardProps) {
  const [status, setStatus] = useState<AiSummaryStatus>("idle");
  const [summary, setSummary] = useState<AiIncidentSummaryResponse | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { byType } = useLimitStatus(projectId ?? undefined);
  const providerLimits = byType.llm_provider ?? [];
  const processorLimits = byType.processor_dispatch ?? [];
  const isProviderLimited = providerLimits.some((limit) => limit.scope?.feature === "ai_summary");
  const isProcessorDelayed = processorLimits.length > 0;

  const requestPayload = useMemo<AiIncidentSummaryRequest>(() => ({}), []);

  const fetchSummary = useCallback((override?: Partial<AiIncidentSummaryRequest>) => {
    setCopied(false);
    setStatus("loading");
    startTransition(() => {
      generateSummary({
        ...requestPayload,
        ...(override ?? {}),
      })
        .then((response) => {
          setSummary(response);
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
  }, [generateSummary, requestPayload]);

  useEffect(() => {
    fetchSummary();
  }, [incidentId, fetchSummary]);

  const generatedAt = summary?.generated_at ?? null;
  const evidence = summary?.evidence_used ?? [];
  const isLoading = status === "loading" || isPending;
  const isStale =
    generatedAt && incidentUpdatedAt
      ? new Date(generatedAt).getTime() < new Date(incidentUpdatedAt).getTime()
      : false;

  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">AI Summary</p>
          <p className="text-xs text-zinc-300">Based on incident evidence</p>
        </div>
        <span className="text-xs text-zinc-300">Draft</span>
      </div>

      {isProcessorDelayed ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Queued — generation is delayed.
        </div>
      ) : null}

      {isProviderLimited ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p>Provider limit hit — try again shortly.</p>
          {lastSuccessAt ? (
            <p className="mt-1 text-[11px] text-amber-100/90">
              Last successful generation: {formatTime(lastSuccessAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-200" />
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>
      ) : null}

      {status === "ready" && summary ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-zinc-100">{summary.summary}</p>
          <p className="text-sm text-zinc-100">
            <span className="font-medium text-zinc-200">Recommended next step:</span>{" "}
            {summary.recommended_next_step ?? "n/a"}
          </p>
          {isStale ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Summary may be outdated — regenerate.
            </div>
          ) : null}
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-300">Based on</p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-200">
              {evidence.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === "insufficient" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
            There isn’t enough evidence yet to generate a reliable summary.
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-300">Based on</p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-200">
              {(summary?.evidence_used ?? ["Incident opened"]).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            AI summary unavailable right now.
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={() => fetchSummary()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {status !== "loading" ? (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
          <span>{generatedAt ? `Generated ${formatTime(generatedAt)}` : "Generated time unavailable"}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="subtle" className="text-white hover:text-zinc-200" onClick={() => fetchSummary({ regenerate: true })}>
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="subtle"
              className="text-white hover:text-zinc-200"
              onClick={() => {
                if (!summary) return;
                void navigator.clipboard?.writeText(buildCopy(summary)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className={cn("mt-1 text-[10px] uppercase tracking-wide text-zinc-400", status === "loading" && "opacity-0")}>
        {summary?.model ? `${summary.model.provider} · ${summary.model.model}` : ""}
      </div>
    </div>
  );
}
