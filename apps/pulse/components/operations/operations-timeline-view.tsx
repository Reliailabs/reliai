"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Cpu,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Power,
  Receipt,
  Layers,
  Terminal,
  Filter,
  X,
  Activity,
  TrendingUp,
} from "lucide-react";
import type {
  OperationsSurfaceData,
  OperationsTimelineEntry,
  OperationsTimelineEventKind,
  ReliabilityScoreRecord,
} from "@/components/dashboard/pulse-types";

// ── Event kind metadata ───────────────────────────────────────────────────────

const KIND_META: Record<
  OperationsTimelineEventKind,
  { label: string; icon: React.ElementType; colorClass: string; dotClass: string }
> = {
  incident_detected: {
    label: "Incident Detected",
    icon: AlertTriangle,
    colorClass: "bg-destructive/10 text-destructive border-destructive/20",
    dotClass: "bg-destructive",
  },
  proposal_generated: {
    label: "Proposal Generated",
    icon: Cpu,
    colorClass: "bg-primary/10 text-primary border-primary/20",
    dotClass: "bg-primary",
  },
  policy_gate_evaluated: {
    label: "Policy Gate",
    icon: ShieldCheck,
    colorClass: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    dotClass: "bg-chart-2",
  },
  remediation_staged: {
    label: "Staged",
    icon: Layers,
    colorClass: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    dotClass: "bg-chart-3",
  },
  approval_recorded: {
    label: "Approved",
    icon: CheckCircle2,
    colorClass: "bg-success/10 text-success border-success/20",
    dotClass: "bg-success",
  },
  receipt_emitted: {
    label: "Receipt",
    icon: Receipt,
    colorClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
  execution_boundary_entered: {
    label: "Execution Boundary",
    icon: Terminal,
    colorClass: "bg-warning/10 text-warning border-warning/20",
    dotClass: "bg-warning",
  },
  verification_result: {
    label: "Verification",
    icon: Activity,
    colorClass: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    dotClass: "bg-chart-1",
  },
  rollback_event: {
    label: "Rollback",
    icon: RotateCcw,
    colorClass: "bg-warning/10 text-warning border-warning/20",
    dotClass: "bg-warning",
  },
  kill_switch_event: {
    label: "Kill Switch",
    icon: Power,
    colorClass: "bg-destructive/10 text-destructive border-destructive/20",
    dotClass: "bg-destructive",
  },
};

const ALL_KINDS = Object.keys(KIND_META) as OperationsTimelineEventKind[];
const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const ACTOR_OPTIONS = ["human", "system"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-destructive/10 text-destructive/80",
  medium: "bg-warning/15 text-warning",
  low: "bg-muted text-muted-foreground",
};

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ entries }: { entries: OperationsTimelineEntry[] }) {
  const stats = useMemo(() => {
    const count = (k: OperationsTimelineEventKind) =>
      entries.filter((e) => e.kind === k).length;
    return [
      { label: "Incidents", value: count("incident_detected"), icon: AlertTriangle, color: "text-destructive" },
      { label: "Proposals", value: count("proposal_generated"), icon: Cpu, color: "text-primary" },
      { label: "Approvals", value: count("approval_recorded"), icon: CheckCircle2, color: "text-success" },
      { label: "Executions", value: count("execution_boundary_entered"), icon: Terminal, color: "text-warning" },
      {
        label: "Verifications",
        value: count("verification_result"),
        icon: Activity,
        color: "text-chart-1",
      },
      { label: "Kill Switches", value: count("kill_switch_event"), icon: Power, color: "text-destructive" },
    ];
  }, [entries]);

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-1"
          >
            <div className={cn("flex items-center gap-1.5", s.color)}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <span className="text-2xl font-semibold text-foreground tabular-nums">
              {s.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  kindFilter: string | null;
  severityFilter: string | null;
  actorFilter: string | null;
  stateFilter: string | null;
  onSet: (key: string, value: string | null) => void;
  activeCount: number;
}

function FilterBar({
  kindFilter,
  severityFilter,
  actorFilter,
  stateFilter,
  onSet,
  activeCount,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span className="font-medium">Filter</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-primary/15 text-primary text-[11px] font-semibold px-1.5 py-0.5">
            {activeCount}
          </span>
        )}
      </div>

      {/* Event kind */}
      <select
        value={kindFilter ?? ""}
        onChange={(e) => onSet("kind", e.target.value || null)}
        className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All events</option>
        {ALL_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_META[k].label}
          </option>
        ))}
      </select>

      {/* Severity */}
      <select
        value={severityFilter ?? ""}
        onChange={(e) => onSet("severity", e.target.value || null)}
        className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All severities</option>
        {SEVERITY_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      {/* Actor */}
      <select
        value={actorFilter ?? ""}
        onChange={(e) => onSet("actor", e.target.value || null)}
        className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All actors</option>
        {ACTOR_OPTIONS.map((a) => (
          <option key={a} value={a}>
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </option>
        ))}
      </select>

      {/* Lifecycle state */}
      <select
        value={stateFilter ?? ""}
        onChange={(e) => onSet("state", e.target.value || null)}
        className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All lifecycle states</option>
        {[
          "detected", "analyzed", "proposed", "staged",
          "approved", "executing", "verified", "failed", "rolled_back", "expired",
        ].map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
          </option>
        ))}
      </select>

      {/* Clear */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            onSet("kind", null);
            onSet("severity", null);
            onSet("actor", null);
            onSet("state", null);
            onSet("incident", null);
            onSet("proposal", null);
          }}
          className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

// ── Timeline entry card ───────────────────────────────────────────────────────

function TimelineEntryCard({ entry }: { entry: OperationsTimelineEntry }) {
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;

  const isDenied =
    entry.policy_gate_result === "denied" ||
    entry.kind === "kill_switch_event";

  return (
    <div
      className={cn(
        "relative flex gap-4 rounded-xl border bg-card px-5 py-4 transition-colors",
        isDenied ? "border-destructive/20 bg-destructive/5" : "border-border hover:bg-muted/30",
      )}
    >
      {/* Left: dot + connector line */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", meta.dotClass)} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Row 1: kind badge + title + policy badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border",
              meta.colorClass,
            )}
          >
            <Icon className="w-3 h-3 shrink-0" />
            {meta.label}
          </span>

          <span className="text-sm font-medium text-foreground leading-snug">
            {entry.title}
          </span>

          {entry.policy_gate_result === "passed" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-success/10 text-success border border-success/20">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              Gate passed
            </span>
          )}
          {entry.policy_gate_result === "denied" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
              <ShieldX className="w-3 h-3 shrink-0" />
              Gate denied
            </span>
          )}
        </div>

        {/* Row 2: summary */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {entry.summary}
        </p>

        {/* Row 3: metadata strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {/* Timestamp */}
          <span
            title={formatAbsoluteTime(entry.occurred_at)}
            className="tabular-nums"
          >
            {formatRelativeTime(entry.occurred_at)}
            <span className="ml-1 text-muted-foreground/60">
              · {formatAbsoluteTime(entry.occurred_at)}
            </span>
          </span>

          {/* Actor */}
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                entry.actor_type === "human" ? "bg-primary" : "bg-muted-foreground",
              )}
            />
            {entry.actor_label}
          </span>

          {/* Lifecycle state */}
          {entry.lifecycle_state && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {entry.lifecycle_state}
            </span>
          )}

          {/* Severity */}
          {entry.severity && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                SEVERITY_COLORS[entry.severity],
              )}
            >
              {entry.severity}
            </span>
          )}

          {/* Incident ID */}
          {entry.incident_id && (
            <span className="text-muted-foreground/70">
              Incident:{" "}
              <span className="font-medium text-foreground/70">
                {entry.incident_id}
              </span>
            </span>
          )}

          {/* Proposal ID */}
          {entry.proposal_id && (
            <span className="text-muted-foreground/70 truncate max-w-[220px]">
              Proposal:{" "}
              <span className="font-mono text-[10px] text-foreground/60">
                {entry.proposal_id.slice(0, 30)}…
              </span>
            </span>
          )}
        </div>

        {/* Row 4: evidence refs */}
        {entry.evidence_refs.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {entry.evidence_refs.map((ref) => (
              <a
                key={ref.href}
                href={ref.href}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                {ref.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Right: lifecycle state badge + execution invariant */}
      {entry.kind === "execution_boundary_entered" && (
        <div className="shrink-0 self-start">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-warning/30 bg-warning/10 text-[10px] font-medium text-warning leading-none">
            <XCircle className="w-3 h-3 shrink-0" />
            execution_granted: false
          </span>
        </div>
      )}
    </div>
  );
}

// ── Reliability score panel ───────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: "text-success",
  B: "text-chart-1",
  C: "text-warning",
  D: "text-destructive/80",
  F: "text-destructive",
};

const GRADE_BG: Record<string, string> = {
  A: "bg-success/10 border-success/20",
  B: "bg-chart-1/10 border-chart-1/20",
  C: "bg-warning/10 border-warning/20",
  D: "bg-destructive/10 border-destructive/20",
  F: "bg-destructive/15 border-destructive/30",
};

const DIMENSION_LABELS: Record<keyof ReliabilityScoreRecord["dimensions"], string> = {
  operationalScore:     "Operational",
  automationConfidence: "Automation",
  recoveryPerformance:  "Recovery",
  policySafetyScore:    "Policy Safety",
};

function ScoreTrendSparkline({ trend }: { trend: ReliabilityScoreRecord["trend"] }) {
  if (trend.length < 2) return null;
  const values = trend.map((p) => p.overall);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const range = Math.max(max - min, 1);
  const W = 80;
  const H = 28;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = W.toFixed(1);
  const lastY = (H - ((values[values.length - 1] - min) / range) * H).toFixed(1);
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        className="stroke-chart-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" className="fill-chart-1" />
    </svg>
  );
}

function ReliabilityScorePanel({ score }: { score: ReliabilityScoreRecord }) {
  const dimKeys = Object.keys(score.dimensions) as Array<
    keyof typeof score.dimensions
  >;

  const lowestDimKey = dimKeys.reduce(
    (min, k) =>
      score.dimensions[k].score < score.dimensions[min].score ? k : min,
    dimKeys[0],
  );
  const lowestDim = score.dimensions[lowestDimKey];
  const lowestFactor = lowestDim.factors.reduce(
    (min, f) => (f.value < min.value ? f : min),
    lowestDim.factors[0],
  );

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-chart-1 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Reliability Score
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Computed from lifecycle, verification, and policy data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <ScoreTrendSparkline trend={score.trend} />
            <span className="text-[11px] text-muted-foreground">7d</span>
          </div>
          <div
            className={cn(
              "flex flex-col items-center rounded-xl border px-4 py-2",
              GRADE_BG[score.overall_grade],
            )}
          >
            <span
              className={cn(
                "text-2xl font-bold tabular-nums leading-none",
                GRADE_COLORS[score.overall_grade],
              )}
            >
              {score.overall}
            </span>
            <span
              className={cn(
                "text-xs font-semibold mt-0.5",
                GRADE_COLORS[score.overall_grade],
              )}
            >
              {score.overall_grade}
            </span>
          </div>
        </div>
      </div>

      {/* Dimension scores */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {dimKeys.map((key) => {
          const dim = score.dimensions[key];
          const isLowest = key === lowestDimKey;
          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border px-3 py-2 flex items-center justify-between gap-2",
                isLowest
                  ? "border-warning/30 bg-warning/5"
                  : "border-border bg-muted/30",
              )}
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">
                  {DIMENSION_LABELS[key]}
                </p>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums leading-none mt-0.5",
                    GRADE_COLORS[dim.grade],
                  )}
                >
                  {dim.score}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-bold shrink-0",
                  GRADE_COLORS[dim.grade],
                )}
              >
                {dim.grade}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actionable signal: weakest factor in lowest dimension */}
      {lowestFactor && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 px-3.5 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-foreground">
              {DIMENSION_LABELS[lowestDimKey]} · {lowestFactor.label}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {lowestFactor.rationale}
            </p>
          </div>
          <span
            className={cn(
              "text-xs font-semibold shrink-0 tabular-nums",
              GRADE_COLORS[lowestDim.grade],
            )}
          >
            {lowestDim.score}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <span className="font-mono text-[10px] text-muted-foreground/60">
          requires_operator_review: true
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          score_id: {score.score_id.slice(0, 20)}…
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OperationsTimelineView({
  operationsData,
}: {
  operationsData?: OperationsSurfaceData;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const kindFilter = searchParams.get("kind") as OperationsTimelineEventKind | null;
  const severityFilter = searchParams.get("severity") as
    | "critical"
    | "high"
    | "medium"
    | "low"
    | null;
  const actorFilter = searchParams.get("actor") as "human" | "system" | null;
  const stateFilter = searchParams.get("state");
  const incidentFilter = searchParams.get("incident");
  const proposalFilter = searchParams.get("proposal");

  const activeFilterCount = [
    kindFilter,
    severityFilter,
    actorFilter,
    stateFilter,
    incidentFilter,
    proposalFilter,
  ].filter(Boolean).length;

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const allEntries = operationsData?.entries ?? [];

  const filteredEntries = useMemo(() => {
    return allEntries.filter((e) => {
      if (kindFilter && e.kind !== kindFilter) return false;
      if (severityFilter && e.severity !== severityFilter) return false;
      if (actorFilter && e.actor_type !== actorFilter) return false;
      if (stateFilter && e.lifecycle_state !== stateFilter) return false;
      if (incidentFilter && e.incident_id !== incidentFilter) return false;
      if (proposalFilter && e.proposal_id !== proposalFilter) return false;
      return true;
    });
  }, [allEntries, kindFilter, severityFilter, actorFilter, stateFilter, incidentFilter, proposalFilter]);

  if (operationsData?.sourceErrors.length) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        Operations Center data unavailable:{" "}
        {operationsData.sourceErrors.join("; ")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Governance boundary note */}
      <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 px-5 py-3">
        <XCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">
            Assisted automation only.
          </span>{" "}
          All proposals require operator confirmation.{" "}
          <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5">
            execution_granted: false
          </span>{" "}
          — no autonomous production mutations. Phase 9 policy gates enforced on every proposal.
        </p>
      </div>

      {/* Stats */}
      <StatsBar entries={allEntries} />

      {/* Reliability score */}
      {operationsData?.reliabilityScore && (
        <ReliabilityScorePanel score={operationsData.reliabilityScore} />
      )}

      {/* Filters */}
      <FilterBar
        kindFilter={kindFilter}
        severityFilter={severityFilter}
        actorFilter={actorFilter}
        stateFilter={stateFilter}
        onSet={setFilter}
        activeCount={activeFilterCount}
      />

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredEntries.length === allEntries.length ? (
            <>
              <span className="font-medium text-foreground">{allEntries.length}</span> events
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{filteredEntries.length}</span> of{" "}
              {allEntries.length} events
            </>
          )}
        </p>
        {operationsData?.dataMode === "demo" && (
          <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Demo data
          </span>
        )}
      </div>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No events match the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => (
            <TimelineEntryCard key={entry.entry_id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
