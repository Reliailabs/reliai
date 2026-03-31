"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import type { AiTicketDraftRequest, AiTicketDraftResponse } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/presenters/ops-format";

type DraftStatus = "idle" | "loading" | "ready" | "insufficient" | "error";

interface AiTicketDraftModalProps {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  incidentUpdatedAt: string | null;
  generateDraft: (payload: AiTicketDraftRequest) => Promise<AiTicketDraftResponse>;
}

export function AiTicketDraftModal({
  open,
  onClose,
  incidentId,
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

  function copyText(text: string, set: (value: boolean) => void) {
    void navigator.clipboard?.writeText(text).then(() => {
      set(true);
      setTimeout(() => set(false), 1500);
    });
  }

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
                <p className="mt-1 text-xs text-steel">Plain text — ready for Jira or GitHub.</p>
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

        {isStale && !isLoading ? (
          <div className="px-6 pb-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Draft may be outdated — incident evidence changed since generation.
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4 text-xs text-zinc-500">
          <span>{generatedAt ? `Generated ${formatTime(generatedAt)}` : "Generated time unavailable"}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="subtle" onClick={() => fetchDraft({ regenerate: true })}>
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => copyText(title, setCopiedTitle)}
            >
              {copiedTitle ? "Copied" : "Copy title"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => copyText(body, setCopiedBody)}
            >
              {copiedBody ? "Copied" : "Copy body"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => copyText([title, "", body].join("\n"), setCopiedFull)}
            >
              {copiedFull ? "Copied" : "Copy full ticket"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
