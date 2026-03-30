"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type {
  AiRootCauseExplanationRequest,
  AiRootCauseExplanationResponse,
} from "@reliai/types";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/presenters/ops-format";

type ExplanationStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiRootCauseExplanationCardProps {
  incidentId: string;
  canGenerate: boolean;
  generateExplanation: (payload: AiRootCauseExplanationRequest) => Promise<AiRootCauseExplanationResponse>;
}

function buildCopy(explanation: AiRootCauseExplanationResponse) {
  if (explanation.status === "error") {
    return "AI Explanation\n\nAI explanation unavailable right now.";
  }
  if (explanation.status !== "ok") {
    return "AI Explanation\n\nThere isn’t enough evidence yet to generate a reliable explanation.";
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
  generateExplanation,
}: AiRootCauseExplanationCardProps) {
  const [status, setStatus] = useState<ExplanationStatus>("idle");
  const [explanation, setExplanation] = useState<AiRootCauseExplanationResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

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
    <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">AI Explanation</p>
          <p className="text-xs text-steel">Interprets the current root-cause evidence</p>
        </div>
        <span className="text-xs text-zinc-400">Draft</span>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-100" />
          <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      ) : null}

      {status === "ready" && explanation ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-ink">{explanation.explanation}</p>
          <p className="text-sm text-ink">
            <span className="font-medium text-ink">What to check next:</span>{" "}
            {explanation.what_to_check_next ?? "n/a"}
          </p>
          {isStale ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Explanation may be outdated — regenerate.
            </div>
          ) : null}
          <div className="rounded-xl bg-zinc-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {evidence.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === "insufficient" ? (
        <div className="mt-4 space-y-3 text-sm text-ink">
          <p>There isn’t enough evidence yet to generate a reliable explanation.</p>
          <div className="rounded-xl bg-zinc-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {(explanation?.evidence_used ?? ["Root cause evidence pending"]).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-4 text-sm text-ink">
          <p>AI explanation unavailable right now.</p>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => fetchExplanation()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {status !== "loading" ? (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>{generatedAt ? `Generated ${formatTime(generatedAt)}` : "Generated time unavailable"}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="subtle" onClick={() => fetchExplanation({ regenerate: true })}>
              Regenerate
            </Button>
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
          </div>
        </div>
      ) : null}

      <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
        {explanation?.model ? `${explanation.model.provider} · ${explanation.model.model}` : ""}
      </div>
    </div>
  );
}
