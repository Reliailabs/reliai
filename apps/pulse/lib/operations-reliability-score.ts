import { listLifecycles, type ProposalLifecycle } from "@/lib/proposal-lifecycle";
import {
  getRecentVerificationIntents,
  type OperationsIntentProjection,
} from "@/lib/operations-ingest-projections";
import type { AppendOnlyRepository, RepositoryAdapter } from "@/lib/repository-contracts";

export type ReliabilityScoreSnapshot = {
  readonly snapshot_id: string;
  readonly captured_at: string;
  readonly organization_id: string;
  readonly project_id: string | null;
  readonly reliability_score: number;
  readonly verification_pass_rate: number | null;
  readonly verified_count: number;
  readonly failed_count: number;
  readonly rolled_back_count: number;
  readonly requires_operator_review: true;
  readonly execution_granted: false;
};

export type ReliabilityScoreFilter = {
  readonly organization_id?: string;
  readonly project_id?: string | null;
};

export interface ReliabilityScoreRepository
  extends AppendOnlyRepository<ReliabilityScoreSnapshot, ReliabilityScoreFilter> {}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildReliabilityScoreSnapshot(
  lifecycles: ProposalLifecycle[],
  verificationIntents: OperationsIntentProjection[],
  capturedAt: string,
  organizationId: string,
  projectId: string | null = null,
): ReliabilityScoreSnapshot {
  const verifiedCount = lifecycles.filter((item) => item.state === "verified").length;
  const failedCount = lifecycles.filter((item) => item.state === "failed").length;
  const rolledBackCount = lifecycles.filter((item) => item.state === "rolled_back").length;

  const verificationOutcomes = verificationIntents.filter(
    (intent) => intent.outcome === "passed" || intent.outcome === "failed",
  );
  const passedVerificationCount = verificationOutcomes.filter(
    (intent) => intent.outcome === "passed",
  ).length;

  const verificationPassRate =
    verificationOutcomes.length > 0
      ? Number((passedVerificationCount / verificationOutcomes.length).toFixed(4))
      : null;

  const base = 70;
  const lifecyclePenalty = failedCount * 8 + rolledBackCount * 5;
  const lifecycleRecovery = verifiedCount * 3;
  const verificationAdjustment =
    verificationPassRate === null ? 0 : (verificationPassRate - 0.5) * 20;

  const reliabilityScore = clampScore(
    base - lifecyclePenalty + lifecycleRecovery + verificationAdjustment,
  );

  return {
    snapshot_id: `score-${organizationId}-${capturedAt}`,
    captured_at: capturedAt,
    organization_id: organizationId,
    project_id: projectId,
    reliability_score: reliabilityScore,
    verification_pass_rate: verificationPassRate,
    verified_count: verifiedCount,
    failed_count: failedCount,
    rolled_back_count: rolledBackCount,
    requires_operator_review: true,
    execution_granted: false,
  };
}

export class InMemoryReliabilityScoreRepository
  implements ReliabilityScoreRepository
{
  private readonly snapshots: ReliabilityScoreSnapshot[];

  constructor(seed?: ReliabilityScoreSnapshot[]) {
    this.snapshots = seed ? [...seed] : [];
  }

  findAll(filter?: ReliabilityScoreFilter): ReliabilityScoreSnapshot[] {
    const sorted = [...this.snapshots].sort(
      (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
    );

    if (!filter) return sorted;

    return sorted.filter((snapshot) => {
      if (
        filter.organization_id !== undefined &&
        snapshot.organization_id !== filter.organization_id
      ) {
        return false;
      }

      if (filter.project_id !== undefined && snapshot.project_id !== filter.project_id) {
        return false;
      }

      return true;
    });
  }
}

function buildFixtureSnapshot(): ReliabilityScoreSnapshot {
  const lifecycles = listLifecycles({ organization_id: "org-demo" });
  const verificationIntents = getRecentVerificationIntents(50);
  return buildReliabilityScoreSnapshot(
    lifecycles,
    verificationIntents,
    new Date().toISOString(),
    "org-demo",
    null,
  );
}

const defaultRepository: RepositoryAdapter<ReliabilityScoreRepository> =
  new InMemoryReliabilityScoreRepository([buildFixtureSnapshot()]);

export function getReliabilityScore(
  repo: ReliabilityScoreRepository = defaultRepository,
): ReliabilityScoreSnapshot {
  const [latest] = repo.findAll();
  if (latest) return latest;

  return buildReliabilityScoreSnapshot([], [], new Date().toISOString(), "org-demo", null);
}
