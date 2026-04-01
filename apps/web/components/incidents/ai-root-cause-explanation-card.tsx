"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type {
  AiRootCauseExplanationRequest,
  AiRootCauseExplanationResponse,
} from "@reliai/types";

import { Button } from "@/components/ui/button";
import { DocsLink } from "@/components/docs/docs-link";
import { formatTime } from "@/components/presenters/ops-format";
import { useLimitStatus } from "@/hooks/use-limit-status";

type ExplanationStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiRootCauseExplanationCardProps {
  incidentId: string;
  canGenerate: boolean;
  projectId?: string | null;
  generateExplanation: (payload: AiRootCauseExplanationRequest) => Promise<AiRootCauseExplanationResponse>;
}

function buildCopy(explanation: AiRootCauseExplanationResponse) {
  if (explanation.status === "error") {
    return "AI Explanation\n\nAI explanation unavailable right now.";
  }
  if (explanation.status !== "ok") {
    return "AI Explanation\n\nThere isn't enough evidence yet to generate a reliable explanation.";
  }
  const evidence = explanation.evidence_used.map((item) => `- ${item}`).join("\n");
  return [
    "AI Explanation",
    explanation.explanation ?? "",
    `What to check next: ${explanation.what_to_check_next ?? "n/a"}`,
    "Based on:",
    evidence,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function AiRootCauseExplanationCard({
  incidentId,
  canGenerate,
  projectId,
  generateExplanation,
}: AiRootCauseExplanationCardProps) {
  const [status, setStatus] = useState<ExplanationStatus>("idle");
  const [explanation, setExplanation] = useState<AiRootCauseExplanationResponse | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { byType } = useLimitStatus(projectId ?? undefined);
  const providerLimits = byType.llm_provider ?? [];
  const processorLimits = byType.processor_dispatch ?? [];
  const isProviderLimited = providerLimits.some((limit) => limit.scope?.feature === "ai_root_cause");
  const isProcessorDelayed = processorLimits.length > 0;

  const requestPayload = useMemo<AiRootCauseExplanationRequest>(() => ({}), []);

  const fetchExplanation = useCallback((override?: Partial<AiRootCauseExplanationRequest>) => {
    if (!canGenerate) {
      setStatus("insufficient");
      return;
    }
    setCopied(false);
    setStatus("loading");
    startTransition(() => {
      generateExplanation({
        ...requestPayload,
        ...(override ?? {}),
      })
        .then((response) => {
          setExplanation(response);
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
  }, [canGenerate, generateExplanation, requestPayload]);

  useEffect(() => {
    fetchExplanation();
  }, [incidentId, fetchExplanation]);

  const generatedAt = explanation?.generated_at ?? null;
  const evidence = explanation?.evidence_used ?? [];
  const isLoading = status === "loading" || isPending;
  const isStale = explanation?.is_stale ?? false;

  return (
    <div className="rounded-2xl border border-zinc-200 border-l-4 border-l-zinc-300 bg-zinc-50 p-5">
      <p className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">
        AI-assisted interpretation
      </p>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">AI Explanation</p>
          <p className="text-xs text-zinc-500">Interprets the current root-cause evidence</p>
        <DocsLink href="/docs/ai" label="How AI works in Reliai" variant="light" />
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
          Draft
        </span>
      </div>

      {isProcessorDelayed ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Queued — generation is delayed.
        </div>
      ) : null}

      {isProviderLimited ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>Provider limit hit — try again shortly.</p>
          {lastSuccessAt ? (
            <p className="mt-1 text-[11px] text-amber-800/90">
              Last successful generation: {formatTime(lastSuccessAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 space-y-4">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-200" />
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>
      ) : null}

      {status === "ready" && explanation ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-zinc-800">{explanation.explanation}</p>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">What to check next</p>
            <p className="mt-1 text-sm text-zinc-700">{explanation.what_to_check_next ?? "n/a"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
            <ul className="mt-2 space-y-1">
              {evidence.map((item) => (
                <li key={item} className="text-sm text-zinc-700">• {item}</li>
              ))}
            </ul>
          </div>
          {isStale && !isLoading ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Explanation may be outdated — incident evidence changed since generation.
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "insufficient" ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            There isn&apos;t enough root-cause evidence yet to generate a reliable explanation.
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
            <ul className="mt-2 space-y-1">
              {(explanation?.evidence_used.length
                ? explanation.evidence_used
                : ["Root cause signal not strong enough", "Awaiting stronger comparison evidence"]
              ).map((item) => (
                <li key={item} className="text-sm text-zinc-700">• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            AI explanation unavailable right now.
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={() => fetchExplanation()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-xs text-zinc-500">
          <span>{generatedAt ? `Generated ${formatTime(generatedAt)}` : "Generated time unavailable"}</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                if (!explanation) return;
                void navigator.clipboard?.writeText(buildCopy(explanation)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => fetchExplanation({ regenerate: true })}
              className={isStale ? "border-amber-200 text-amber-700 hover:bg-amber-50" : undefined}
            >
              Regenerate
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
