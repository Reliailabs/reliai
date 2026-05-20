"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, GitCompare, History, LifeBuoy, ShieldCheck, ShieldX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { IncidentOperationsSurfaceData, IncidentOperationsTab } from "@/lib/incident-operations-data";
import { OperationsReliabilitySummaryPanel } from "@/components/operations/operations-reliability-summary-panel";
import { resolveIncidentOperationsTab } from "@/lib/incident-operations-tabs";

const TAB_ORDER: Array<{ id: IncidentOperationsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "investigation", label: "Investigation" },
  { id: "compare", label: "Compare" },
  { id: "timeline", label: "Timeline" },
  { id: "proposals", label: "Proposals" },
  { id: "verification", label: "Verification" },
  { id: "rollback", label: "Rollback" },
];

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function DataModePill({ dataMode }: { dataMode: "live" | "demo" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        dataMode === "demo"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-success/40 bg-success/10 text-success",
      )}
    >
      {dataMode === "demo" ? "Demo data" : "Live data"}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function IncidentOperationsSurface({ data }: { data: IncidentOperationsSurfaceData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab = resolveIncidentOperationsTab(tabParam) as IncidentOperationsTab;
  const scopedProjectId = searchParams.get("project_id") ?? data.projectId;
  const scopeQuery = scopedProjectId ? `?project_id=${encodeURIComponent(scopedProjectId)}` : "";
  const withScopedProject = (path: string): string => {
    if (!scopedProjectId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}project_id=${encodeURIComponent(scopedProjectId)}`;
  };

  const setTab = (tab: IncidentOperationsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const reliabilityLine = useMemo(() => {
    const policyText =
      data.reliabilityContext.latestPolicyDecision === "unavailable"
        ? "Policy gate status unavailable"
        : data.reliabilityContext.latestPolicyDecision === "passed"
          ? "Latest policy gate passed"
          : "Latest policy gate denied";
    return `${data.reliabilityContext.openRelatedProposals} open related proposal(s) • ${policyText}`;
  }, [data.reliabilityContext.latestPolicyDecision, data.reliabilityContext.openRelatedProposals]);

  const incident = data.incident;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Operations center
              </Link>
              <Link href={`${withScopedProject(`/incidents/${data.incidentId}`)}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Legacy incident view
              </Link>
              <Link href={`/operations/graph/${data.incidentId}${scopeQuery}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Open graph
              </Link>
            </div>
            <h1 className="text-2xl font-semibold">Incident Operations — {data.incidentId}</h1>
            <p className="text-sm text-muted-foreground">
              Read-only incident workflow surface. Requires operator review.
            </p>
          </div>
          <DataModePill dataMode={data.dataMode} />
        </div>

        {data.sourceErrors.length > 0 ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Data source unavailable: {data.sourceErrors.join(", ")}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{incident?.title ?? "Incident snapshot unavailable"}</p>
              <p className="text-sm text-muted-foreground">{incident?.description ?? "No incident detail record was returned for this ID."}</p>
            </div>
            <p className="text-xs text-muted-foreground">{reliabilityLine}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-1">
          <div className="grid grid-cols-2 gap-1 md:grid-cols-7">
            {TAB_ORDER.map((tab) => (
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
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Severity</p>
                <p className="mt-2 text-lg font-semibold">{incident?.severity ?? "unknown"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="mt-2 text-lg font-semibold">{incident?.status ?? "unavailable"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                <p className="mt-2 text-lg font-semibold">{incident?.duration ?? "unknown"}</p>
              </div>
            </div>
            <OperationsReliabilitySummaryPanel snapshot={data.reliabilitySnapshot} />
          </div>
        ) : null}

        {activeTab === "investigation" ? (
          <div className="space-y-4">
            {incident?.intelligence.contributingFactors.length ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium">Observed contributing factors</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {incident.intelligence.contributingFactors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                title="No investigation factors yet"
                description="Evidence-linked factors will appear when traces, deployments, or errors are connected to this incident."
              />
            )}
            {incident?.intelligence.evidenceLinks.length ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium">Evidence references</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.intelligence.evidenceLinks.map((link) => (
                    <Link key={`${link.href}-${link.label}`} href={withScopedProject(link.href)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "compare" ? (
          <div className="space-y-3">
            {data.compareLinks.length > 0 ? (
              data.compareLinks.map((link) => (
                <Link key={link.href} href={withScopedProject(link.href)} className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm hover:bg-muted">
                  <GitCompare className="h-4 w-4 text-primary" />
                  {link.label}
                </Link>
              ))
            ) : (
              <EmptyState
                title="No compare references available"
                description="Trace compare links appear when incident detail includes compare-path evidence."
              />
            )}
          </div>
        ) : null}

        {activeTab === "timeline" ? (
          <div className="space-y-3">
            {data.timelineEntries.length > 0 ? (
              data.timelineEntries.map((entry) => (
                <div key={entry.entry_id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{entry.title}</p>
                    <span className="text-xs text-muted-foreground">{formatTime(entry.occurred_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No operations timeline entries"
                description="Timeline events for this incident will appear as proposal and verification lifecycle records are ingested."
              />
            )}
          </div>
        ) : null}

        {activeTab === "proposals" ? (
          <div className="space-y-3">
            {data.proposals.length > 0 ? (
              data.proposals.map((proposal) => (
                <div key={proposal.lifecycle_id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{proposal.action_type} • {proposal.target_type}</p>
                    <span className="text-xs text-muted-foreground">{proposal.state}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Proposal: {proposal.proposal_id}</p>
                  <p className="text-xs text-muted-foreground">Updated: {formatTime(proposal.updated_at)}</p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No proposal lifecycle records"
                description="Related proposals will show here once the incident is linked to lifecycle records."
              />
            )}
          </div>
        ) : null}

        {activeTab === "verification" ? (
          <div className="space-y-3">
            {data.verificationRecords.length > 0 ? (
              data.verificationRecords.map((record) => (
                <div key={record.lifecycleId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {record.state === "verified" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <ShieldX className="h-4 w-4 text-destructive" />
                    )}
                    {record.state}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Verification ID: {record.verificationResultId ?? "not recorded"}</p>
                  <p className="text-xs text-muted-foreground">Updated: {formatTime(record.updatedAt)}</p>
                  {record.reason ? <p className="mt-1 text-sm text-muted-foreground">{record.reason}</p> : null}
                </div>
              ))
            ) : (
              <EmptyState
                title="No verification records"
                description="Verification outcomes appear when proposals move into verified or failed states."
              />
            )}
          </div>
        ) : null}

        {activeTab === "rollback" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Rollback is read-only in Phase 12.1. No rollback execution actions are available.
            </div>
            {data.rollbackRecords.length > 0 ? (
              data.rollbackRecords.map((record) => (
                <div key={record.lifecycleId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {record.state === "rolled_back" ? (
                      <ShieldCheck className="h-4 w-4 text-success" />
                    ) : record.state === "executing" ? (
                      <Clock3 className="h-4 w-4 text-warning" />
                    ) : (
                      <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                    )}
                    {record.state}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Proposal: {record.proposalId}</p>
                  <p className="text-xs text-muted-foreground">Updated: {formatTime(record.updatedAt)}</p>
                  {record.reason ? <p className="mt-1 text-sm text-muted-foreground">{record.reason}</p> : null}
                </div>
              ))
            ) : (
              <EmptyState
                title="No rollback lifecycle records"
                description="Rollback lifecycle history appears here when rollback proposals are linked to this incident."
              />
            )}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Advisory intelligence only
          </p>
          <p className="mt-1">
            Requires operator review. No approvals, execution, or rollback actions are performed on this surface.
          </p>
        </div>
      </div>
    </div>
  );
}
