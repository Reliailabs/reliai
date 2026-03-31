"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import type { AiTicketDraftRequest, AiTicketDraftResponse } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/presenters/ops-format";
import { cn } from "@/lib/utils";

type DraftStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiTicketDraftModalProps {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  incidentTitle: string;
  incidentUpdatedAt: string | null;
  generateDraft: (payload: AiTicketDraftRequest) => Promise<AiTicketDraftResponse>;
}

function buildFullTicket(editedTitle: string, editedBody: string) {
  return [editedTitle, "", editedBody].filter(Boolean).join("\n");
}

const INSUFFICIENT_EVIDENCE_BULLETS = [
  "Incident opened",
  "Awaiting stronger root-cause evidence",
  "Awaiting comparison or prompt diff",
];

export function AiTicketDraftModal({
  open,
  onClose,
  incidentId,
  incidentTitle,
  incidentUpdatedAt,
  generateDraft,
}: AiTicketDraftModalProps) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [draft, setDraft] = useState<AiTicketDraftResponse | null>(null);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const resetState = useCallback(() => {
    setStatus("idle");
    setDraft(null);
    setTitle("");
    setBody("");
    setCopiedTitle(false);
    setCopiedBody(false);
    setCopiedFull(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const fetchDraft = useCallback((override?: Partial<AiTicketDraftRequest>) => {
    setCopiedTitle(false);
    setCopiedBody(false);
    setCopiedFull(false);
    setStatus("loading");
    startTransition(() => {
      generateDraft({
        destination: "jira",
        ...(override ?? {}),
      })
        .then((response) => {
          setDraft(response);
          if (response.status === "ok") {
            setTitle(response.title ?? "");
            setBody(response.body ?? "");
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
  }, [generateDraft]);

  useEffect(() => {
    if (!open) return;
    fetchDraft();
  }, [open, incidentId, fetchDraft]);

  if (!open) return null;

  const isLoading = status === "loading" || isPending;
  const evidence = draft?.evidence_used ?? [];
  const generatedAt = draft?.generated_at ?? null;
  const isStale =
    generatedAt && incidentUpdatedAt
      ? new Date(generatedAt).getTime() < new Date(incidentUpdatedAt).getTime()
      : false;

  function copyText(text: string, set: (v: boolean) => void) {
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
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-5">
          <div>
            <p className="text-xl font-semibold text-zinc-950">Draft Ticket</p>
            <p className="mt-0.5 text-sm text-zinc-500">Based on incident evidence</p>
            <p className="mt-1 text-xs text-zinc-500">Built from current incident evidence. Review before use.</p>
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

        <div className="flex shrink-0 flex-col gap-1 border-b border-zinc-200 bg-zinc-50 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-zinc-800 truncate">{incidentId} · {incidentTitle}</span>
            <span className="shrink-0 text-zinc-400">·</span>
            <span className="shrink-0 text-zinc-500">
              {generatedAt ? `Generated ${formatTime(generatedAt)}` : isLoading ? "Generating…" : "Generated time unavailable"}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Ready to paste into Jira or GitHub. Edit before use.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-200" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-12 animate-pulse rounded bg-zinc-200" />
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 space-y-2.5">
                  {[1, 1, 0.9, 0.8, 1, 0.65].map((w, i) => (
                    <div
                      key={i}
                      className="h-3 animate-pulse rounded bg-zinc-200"
                      style={{ width: `${w * 100}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 space-y-2">
                <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
              </div>
            </div>
          ) : null}

          {status === "ready" ? (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-zinc-900">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-medium text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-900">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-2 w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  style={{ minHeight: "320px" }}
                />
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
                <ul className="mt-2 space-y-1.5">
                  {evidence.map((item) => (
                    <li key={item} className="text-sm text-zinc-700">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {status === "insufficient" ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-700">
                There isn&apos;t enough evidence yet to draft a reliable ticket.
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
                <ul className="mt-2 space-y-1.5">
                  {(evidence.length > 0 ? evidence : INSUFFICIENT_EVIDENCE_BULLETS).map((item) => (
                    <li key={item} className="text-sm text-zinc-700">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">AI ticket draft unavailable right now.</p>
              <Button size="sm" variant="outline" onClick={() => fetchDraft()}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>

        {isStale && !isLoading ? (
          <div className="shrink-0 px-6 pb-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Draft may be outdated — incident evidence changed since generation.
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="subtle"
              disabled={status !== "ready"}
              onClick={() => copyText(title, setCopiedTitle)}
            >
              {copiedTitle ? "Copied" : "Copy title"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              disabled={status !== "ready"}
              onClick={() => copyText(body, setCopiedBody)}
            >
              {copiedBody ? "Copied" : "Copy body"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              disabled={status !== "ready"}
              onClick={() => copyText(buildFullTicket(title, body), setCopiedFull)}
            >
              {copiedFull ? "Copied" : "Copy full ticket"}
            </Button>
          </div>

          <Button
            size="sm"
            variant="subtle"
            disabled={isLoading}
            onClick={() => fetchDraft({ regenerate: true })}
            className={cn(isStale && "border-amber-200 text-amber-700 hover:bg-amber-50")}
          >
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
