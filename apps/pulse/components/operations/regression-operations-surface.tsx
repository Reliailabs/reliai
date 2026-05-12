"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, GitCompare, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RegressionOperationsSurfaceData, RegressionOperationsTab } from "@/lib/regression-operations-data";

const TABS: Array<{ id: RegressionOperationsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "compare", label: "Compare" },
  { id: "timeline", label: "Timeline" },
  { id: "related-incidents", label: "Related Incidents" },
  { id: "proposals", label: "Proposals" },
  { id: "verification", label: "Verification" },
];

function resolveTab(value: string | null): RegressionOperationsTab {
  if (!value) return "overview";
  return TABS.some((tab) => tab.id === value) ? (value as RegressionOperationsTab) : "overview";
}

function time(v: string | null): string {
  if (!v) return "unknown";
  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function RegressionOperationsSurface({ data }: { data: RegressionOperationsSurfaceData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));

  const setTab = (tab: RegressionOperationsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-6 py-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Operations center
            </Link>
            <Link href="/traces" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Trace investigation
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">Regression Operations — {data.regressionId}</h1>
          <p className="text-sm text-muted-foreground">Read-only regression workflow surface. Requires operator review.</p>
        </div>

        {data.sourceErrors.length > 0 ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Data source unavailable: {data.sourceErrors.join(", ")}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">
            {data.regression?.summary ?? "Regression detail unavailable."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Detected: {time(data.regression?.detectedAt ?? null)} • Status: {data.regression?.status ?? "unknown"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-1">
          <div className="grid grid-cols-2 gap-1 md:grid-cols-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Regression signals represent causality/signature context. Incident impact remains in incident operations surfaces.
          </div>
        ) : null}

        {activeTab === "compare" ? (
          <div className="space-y-3">
            {data.compareLinks.map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm hover:bg-muted">
                <GitCompare className="h-4 w-4 text-primary" />
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}

        {activeTab === "timeline" ? (
          <div className="space-y-3">
            {data.timelineEntries.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No timeline events linked to this regression ID yet.
              </div>
            ) : (
              data.timelineEntries.map((entry) => (
                <div key={entry.entry_id} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-sm text-muted-foreground">{entry.summary}</p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "related-incidents" ? (
          <div className="space-y-3">
            {data.relatedIncidents.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No related incidents linked to this regression yet.
              </div>
            ) : (
              data.relatedIncidents.map((incident) => (
                <Link key={incident.id} href={`/incidents/${incident.id}`} className="block rounded-xl border border-border bg-card p-4 hover:bg-muted">
                  <p className="text-sm font-medium">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">{incident.id} • {incident.severity} • {incident.status}</p>
                </Link>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "proposals" ? (
          <div className="space-y-3">
            {data.proposals.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No proposal lifecycle records linked to this regression.
              </div>
            ) : (
              data.proposals.map((proposal) => (
                <div key={proposal.lifecycle_id} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">{proposal.action_type} • {proposal.state}</p>
                  <p className="text-xs text-muted-foreground">{proposal.proposal_id}</p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "verification" ? (
          <div className="space-y-3">
            {data.verificationRecords.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No verification outcomes for linked proposals yet.
              </div>
            ) : (
              data.verificationRecords.map((record) => (
                <div key={record.proposalId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {record.state === "verified" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {record.state}
                  </div>
                  <p className="text-xs text-muted-foreground">{record.proposalId}</p>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Advisory intelligence only
          </p>
          <p className="mt-1">Requires operator review. No write-path, execution, or approval actions are available.</p>
        </div>
      </div>
    </div>
  );
}
