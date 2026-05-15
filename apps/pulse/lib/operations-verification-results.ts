import { listLifecycles, type ProposalLifecycle } from "@/lib/proposal-lifecycle";
import type { ReadWriteRepository, RepositoryAdapter } from "@/lib/repository-contracts";

export type VerificationOutcome = "passed" | "failed";

export type VerificationResultRecord = {
  readonly verification_result_id: string;
  readonly lifecycle_id: string;
  readonly proposal_id: string;
  readonly organization_id: string;
  readonly target_id: string;
  readonly outcome: VerificationOutcome;
  readonly verified_at: string;
  readonly execution_granted: false;
  readonly requires_operator_review: true;
};

export type VerificationResultFilter = {
  readonly organization_id?: string;
  readonly proposal_id?: string;
  readonly lifecycle_id?: string;
  readonly target_id?: string;
  readonly outcome?: VerificationOutcome;
};

export interface VerificationResultRepository
  extends ReadWriteRepository<VerificationResultRecord, VerificationResultFilter> {}

export function isVerificationLifecycleState(
  state: ProposalLifecycle["state"],
): state is "verified" | "failed" {
  return state === "verified" || state === "failed";
}

export function mapLifecycleToVerificationResult(
  lifecycle: ProposalLifecycle,
): VerificationResultRecord | null {
  if (!isVerificationLifecycleState(lifecycle.state)) return null;
  if (!lifecycle.verification_result_id) return null;

  return {
    verification_result_id: lifecycle.verification_result_id,
    lifecycle_id: lifecycle.lifecycle_id,
    proposal_id: lifecycle.proposal_id,
    organization_id: lifecycle.organization_id,
    target_id: lifecycle.target_id,
    outcome: lifecycle.state === "verified" ? "passed" : "failed",
    verified_at: lifecycle.updated_at,
    execution_granted: false,
    requires_operator_review: true,
  };
}

export function deriveVerificationResultsFromLifecycles(
  lifecycles: ProposalLifecycle[],
): VerificationResultRecord[] {
  return lifecycles
    .map(mapLifecycleToVerificationResult)
    .filter((record): record is VerificationResultRecord => record !== null)
    .sort((a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime());
}

export class InMemoryVerificationResultRepository
  implements VerificationResultRepository
{
  private readonly records: VerificationResultRecord[];

  constructor(seed?: VerificationResultRecord[]) {
    this.records = seed ? [...seed] : [];
  }

  findById(id: string): VerificationResultRecord | null {
    return this.records.find((record) => record.verification_result_id === id) ?? null;
  }

  findAll(filter?: VerificationResultFilter): VerificationResultRecord[] {
    const sorted = [...this.records].sort(
      (a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime(),
    );
    if (!filter) return sorted;

    return sorted.filter((record) => {
      if (filter.organization_id !== undefined && record.organization_id !== filter.organization_id) return false;
      if (filter.proposal_id !== undefined && record.proposal_id !== filter.proposal_id) return false;
      if (filter.lifecycle_id !== undefined && record.lifecycle_id !== filter.lifecycle_id) return false;
      if (filter.target_id !== undefined && record.target_id !== filter.target_id) return false;
      if (filter.outcome !== undefined && record.outcome !== filter.outcome) return false;
      return true;
    });
  }

  save(entity: VerificationResultRecord): VerificationResultRecord {
    const copy = { ...entity };
    const idx = this.records.findIndex(
      (record) => record.verification_result_id === entity.verification_result_id,
    );
    if (idx >= 0) this.records[idx] = copy;
    else this.records.push(copy);
    return { ...copy };
  }
}

function buildFixtureRepo(): InMemoryVerificationResultRepository {
  return new InMemoryVerificationResultRepository(
    deriveVerificationResultsFromLifecycles(listLifecycles()),
  );
}

const defaultRepository: RepositoryAdapter<VerificationResultRepository> = buildFixtureRepo();

export function getVerificationResults(
  filter?: VerificationResultFilter,
  repo: VerificationResultRepository = defaultRepository,
): VerificationResultRecord[] {
  return repo.findAll(filter);
}
