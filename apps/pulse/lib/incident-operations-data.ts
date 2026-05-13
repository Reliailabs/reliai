import "server-only";

import { getIncidentsSurfaceData } from "@/lib/incidents-data";
import { getOperationsSurfaceData, type OperationsTimelineRepository } from "@/lib/operations-timeline";
import {
  getOperationsAdapterMode,
  createLifecycleRepo,
  type ProposalLifecycleRepository,
} from "@/lib/operations-adapter";
import { InMemoryProposalLifecycleRepository, type ProposalLifecycle } from "@/lib/proposal-lifecycle";
import type { IncidentSurfaceItem, OperationsTimelineEntry } from "@/components/dashboard/pulse-types";

export type IncidentOperationsTab =
  | "overview"
  | "investigation"
  | "compare"
  | "timeline"
  | "proposals"
  | "verification"
  | "rollback";

export type IncidentOperationsVerificationRecord = {
  lifecycleId: string;
  proposalId: string;
  state: "verified" | "failed";
  verificationResultId: string | null;
  updatedAt: string;
  reason: string | null;
};

export type IncidentOperationsRollbackRecord = {
  lifecycleId: string;
  proposalId: string;
  state: "approved" | "executing" | "rolled_back";
  updatedAt: string;
  reason: string | null;
};

export type IncidentOperationsSurfaceData = {
  incidentId: string;
  incident: IncidentSurfaceItem | null;
  timelineEntries: OperationsTimelineEntry[];
  proposals: ProposalLifecycle[];
  verificationRecords: IncidentOperationsVerificationRecord[];
  rollbackRecords: IncidentOperationsRollbackRecord[];
  compareLinks: Array<{ label: string; href: string }>;
  sourceErrors: string[];
  dataMode: "live" | "demo";
  reliabilityContext: {
    openRelatedProposals: number;
    latestPolicyDecision: "passed" | "denied" | "unavailable";
  };
};

type AsyncLifecycleRepo = ProposalLifecycleRepository & {
  fetchAll: (filter?: { organization_id?: string; state?: string; proposal_id?: string }) => Promise<ProposalLifecycle[]>;
  drainErrors: () => string[];
};

function isAsyncLifecycleRepo(repo: ProposalLifecycleRepository): repo is AsyncLifecycleRepo {
  return "fetchAll" in repo && typeof (repo as AsyncLifecycleRepo).fetchAll === "function";
}

function isVerificationState(state: ProposalLifecycle["state"]): state is "verified" | "failed" {
  return state === "verified" || state === "failed";
}

function isRollbackState(state: ProposalLifecycle["state"]): state is "approved" | "executing" | "rolled_back" {
  return state === "approved" || state === "executing" || state === "rolled_back";
}

function extractTransitionReason(lifecycle: ProposalLifecycle): string | null {
  return lifecycle.state_history[lifecycle.state_history.length - 1]?.reason ?? null;
}

async function readLifecycles(repo: ProposalLifecycleRepository): Promise<{ lifecycles: ProposalLifecycle[]; sourceErrors: string[] }> {
  if (isAsyncLifecycleRepo(repo)) {
    const lifecycles = await repo.fetchAll();
    return { lifecycles, sourceErrors: repo.drainErrors() };
  }
  return { lifecycles: repo.findAll(), sourceErrors: [] };
}

function buildFallbackIncident(
  incidentId: string,
  timelineEntries: OperationsTimelineEntry[],
  proposals: ProposalLifecycle[],
): IncidentSurfaceItem | null {
  const related = timelineEntries.filter((entry) => entry.incident_id === incidentId);
  if (related.length === 0) return null;

  const latest = related[0];
  const timeline = related.slice(0, 4).map((entry) => {
    const d = entry.occurred_at ? new Date(entry.occurred_at) : null;
    const time = d && !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
    return { time, event: entry.title, type: entry.kind === "verification_result" ? ("action" as const) : ("alert" as const) };
  });

  return {
    id: incidentId,
    title: `Operations incident ${incidentId}`,
    description: latest.summary,
    severity: latest.severity ?? "medium",
    status: "investigating",
    duration: "unknown",
    assignee: "Unassigned",
    assigneeInitials: "UA",
    impactedServices: proposals
      .filter((proposal) => proposal.target_id === incidentId || proposal.target_type === "incident")
      .map((proposal) => proposal.target_type)
      .slice(0, 1)
      .concat("Operations")
      .slice(0, 2),
    timeline,
    intelligence: {
      contributingFactors: related.slice(0, 3).map((entry) => entry.summary),
      confidence: "insufficient",
      evidenceLinks: [{ label: "Operations timeline", href: `/operations/incidents/${incidentId}?tab=timeline` }],
      requiresOperatorReview: true,
    },
  };
}

export async function getIncidentOperationsSurfaceData(
  incidentId: string,
  deps?: {
    lifecycleRepo?: ProposalLifecycleRepository;
    timelineRepo?: OperationsTimelineRepository;
  },
): Promise<IncidentOperationsSurfaceData> {
  const sourceErrors: string[] = [];
  const lifecycleRepo =
    deps?.lifecycleRepo ??
    createLifecycleRepo(getOperationsAdapterMode(), new InMemoryProposalLifecycleRepository());
  const timelineRepo = deps?.timelineRepo;

  const [incidentsData, operationsData, lifecycleRead] = await Promise.all([
    getIncidentsSurfaceData(),
    getOperationsSurfaceData(timelineRepo),
    readLifecycles(lifecycleRepo),
  ]);

  sourceErrors.push(...incidentsData.sourceErrors, ...operationsData.sourceErrors, ...lifecycleRead.sourceErrors);

  const incidentFromList = incidentsData.incidents.find((item) => item.id === incidentId) ?? null;
  const timelineEntries = operationsData.entries.filter((entry) => entry.incident_id === incidentId);
  const proposals = lifecycleRead.lifecycles.filter(
    (lifecycle) => lifecycle.target_id === incidentId || timelineEntries.some((entry) => entry.proposal_id === lifecycle.proposal_id),
  );

  const incident = incidentFromList ?? buildFallbackIncident(incidentId, timelineEntries, proposals);

  const verificationRecords: IncidentOperationsVerificationRecord[] = proposals
    .filter((proposal) => isVerificationState(proposal.state))
    .map((proposal) => ({
      lifecycleId: proposal.lifecycle_id,
      proposalId: proposal.proposal_id,
      state: proposal.state,
      verificationResultId: proposal.verification_result_id,
      updatedAt: proposal.updated_at,
      reason: extractTransitionReason(proposal),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const rollbackRecords: IncidentOperationsRollbackRecord[] = proposals
    .filter((proposal) => proposal.action_type === "rollback" && isRollbackState(proposal.state))
    .map((proposal) => ({
      lifecycleId: proposal.lifecycle_id,
      proposalId: proposal.proposal_id,
      state: proposal.state,
      updatedAt: proposal.updated_at,
      reason: proposal.failure_reason ?? extractTransitionReason(proposal),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const compareLinks = Array.from(
    new Map(
      (incident?.intelligence.evidenceLinks ?? [])
        .filter((link) => link.href.includes("/compare") || link.label.toLowerCase().includes("compare"))
        .map((link) => [link.href, link]),
    ).values(),
  );

  const openRelatedProposals = proposals.filter(
    (proposal) => !["verified", "failed", "rolled_back", "expired"].includes(proposal.state),
  ).length;
  const latestPolicyDecision =
    timelineEntries.find((entry) => entry.kind === "policy_gate_evaluated")?.policy_gate_result ?? "unavailable";

  const inferredMode =
    getOperationsAdapterMode() === "fixture" || operationsData.dataMode === "demo" || incidentsData.dataMode === "demo"
      ? "demo"
      : "live";

  return {
    incidentId,
    incident,
    timelineEntries,
    proposals,
    verificationRecords,
    rollbackRecords,
    compareLinks,
    sourceErrors: Array.from(new Set(sourceErrors)),
    dataMode: inferredMode,
    reliabilityContext: {
      openRelatedProposals,
      latestPolicyDecision,
    },
  };
}
