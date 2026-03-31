"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type { AiTicketDraftRequest, AiTicketDraftResponse } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/presenters/ops-format";
import { cn } from "@/lib/utils";

type DraftStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiTicketDraftModalProps {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  generateDraft: (payload: AiTicketDraftRequest) => Promise<AiTicketDraftResponse>;
}

function buildCopy(draft: AiTicketDraftResponse) {
  if (draft.status === "error") {
    return "AI Ticket Draft\n\nAI ticket draft unavailable right now.";
  }
  if (draft.status !== "ok") {
    return "AI Ticket Draft\n\nThere isn’t enough evidence yet to generate a reliable ticket draft.";
  }
  return [
    draft.title ?? "",
    "",
    draft.body ?? "",
  ].join("\n");
}

export function AiTicketDraftModal({ open, onClose, incidentId, generateDraft }: AiTicketDraftModalProps) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [draft, setDraft] = useState<AiTicketDraftResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [destination, setDestination] = useState<AiTicketDraftRequest["destination"]>("jira");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const basePayload = useMemo<AiTicketDraftRequest>(() => ({ destination }), [destination]);

  const fetchDraft = useCallback((override?: Partial<AiTicketDraftRequest>) => {
    setCopied(false);
    setStatus("loading");
    startTransition(() => {
      generateDraft({
        ...basePayload,
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
  }, [basePayload, generateDraft]);

  useEffect(() => {
    if (!open) return;
    fetchDraft();
  }, [open, incidentId, fetchDraft]);

  if (!open) return null;

  const isLoading = status === "loading" || isPending;
  const evidence = draft?.evidence_used ?? [];
  const generatedAt = draft?.generated_at ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-3xl rounded-[20px] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">AI Ticket Draft</p>
            <p className="text-xs text-steel">Based on incident evidence</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Draft</span>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-steel">Destination</span>
            <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1">
              {(["jira", "github"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDestination(option);
                    fetchDraft({ destination: option, regenerate: true });
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    destination === option ? "bg-white text-ink shadow-sm" : "text-steel"
                  )}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
            </div>
          ) : null}

          {status === "ready" ? (
            <>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-steel">Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-steel">Body</label>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={10}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-ink"
                />
              </div>
              <div className="rounded-xl bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {evidence.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          {status === "insufficient" ? (
            <div className="space-y-3 text-sm text-ink">
              <p>There isn’t enough evidence yet to generate a reliable ticket draft.</p>
              <div className="rounded-xl bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Based on</p>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {(draft?.evidence_used ?? ["Incident opened"]).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="text-sm text-ink">
              <p>AI ticket draft unavailable right now.</p>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => fetchDraft()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4 text-xs text-zinc-500">
          <span>{generatedAt ? `Generated ${formatTime(generatedAt)}` : "Generated time unavailable"}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="subtle" onClick={() => fetchDraft({ regenerate: true })}>
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                if (!draft) return;
                void navigator.clipboard?.writeText(title).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy title"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                if (!draft) return;
                void navigator.clipboard?.writeText(body).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy body"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                if (!draft) return;
                void navigator.clipboard?.writeText(buildCopy(draft)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy full ticket"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
