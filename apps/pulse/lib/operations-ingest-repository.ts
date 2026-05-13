import type { RepositoryAdapter } from "@/lib/repository-contracts";
import type { OperationsEventIngestRequest } from "@/lib/operations-ingest";

export type OperationsIngestFilter = {
  organization_id?: string;
  event_type?: OperationsEventIngestRequest["event_type"];
  target_id?: string;
  idempotency_key?: string;
};

export type OperationsIngestRecord = {
  ingest_record_id: string;
  accepted_at: string;
  event_fingerprint: string;
  request_shape_hash: string;
  event: OperationsEventIngestRequest;
};

export interface OperationsIngestRepository {
  append(record: OperationsIngestRecord): OperationsIngestRecord;
  findByFingerprint(eventFingerprint: string): OperationsIngestRecord | null;
  findByIdempotencyKey(idempotencyKey: string): OperationsIngestRecord | null;
  findAll(filter?: OperationsIngestFilter): OperationsIngestRecord[];
}

export class InMemoryOperationsIngestRepository implements OperationsIngestRepository {
  private readonly byFingerprint = new Map<string, OperationsIngestRecord>();
  private readonly byIdempotencyKey = new Map<string, OperationsIngestRecord>();

  append(record: OperationsIngestRecord): OperationsIngestRecord {
    const stored = { ...record, event: { ...record.event } };
    this.byFingerprint.set(stored.event_fingerprint, stored);
    this.byIdempotencyKey.set(stored.event.idempotency_key, stored);
    return { ...stored, event: { ...stored.event } };
  }

  findByFingerprint(eventFingerprint: string): OperationsIngestRecord | null {
    const record = this.byFingerprint.get(eventFingerprint);
    if (!record) return null;
    return { ...record, event: { ...record.event } };
  }

  findByIdempotencyKey(idempotencyKey: string): OperationsIngestRecord | null {
    const record = this.byIdempotencyKey.get(idempotencyKey);
    if (!record) return null;
    return { ...record, event: { ...record.event } };
  }

  findAll(filter?: OperationsIngestFilter): OperationsIngestRecord[] {
    const all = Array.from(this.byFingerprint.values());
    if (!filter) return all.map((row) => ({ ...row, event: { ...row.event } }));
    return all
      .filter((row) => {
        if (filter.organization_id && row.event.request_context.organization_id !== filter.organization_id) return false;
        if (filter.event_type && row.event.event_type !== filter.event_type) return false;
        if (filter.target_id && row.event.target.target_id !== filter.target_id) return false;
        if (filter.idempotency_key && row.event.idempotency_key !== filter.idempotency_key) return false;
        return true;
      })
      .map((row) => ({ ...row, event: { ...row.event } }));
  }
}

export class BackendOperationsIngestRepository implements OperationsIngestRepository {
  append(): OperationsIngestRecord {
    throw new Error("operations ingest backend adapter stub: append not implemented");
  }

  findByFingerprint(): OperationsIngestRecord | null {
    return null;
  }

  findByIdempotencyKey(): OperationsIngestRecord | null {
    return null;
  }

  findAll(): OperationsIngestRecord[] {
    return [];
  }
}

export type OperationsIngestAdapterMode = "fixture" | "live";

export function getOperationsIngestAdapterMode(): OperationsIngestAdapterMode {
  return process.env.RELIAI_OPERATIONS_DATA_MODE === "live" ? "live" : "fixture";
}

export function createOperationsIngestRepo(
  mode: OperationsIngestAdapterMode,
  fixtureRepo: OperationsIngestRepository = new InMemoryOperationsIngestRepository(),
): RepositoryAdapter<OperationsIngestRepository> {
  return mode === "live" ? new BackendOperationsIngestRepository() : fixtureRepo;
}

const globalStore = globalThis as typeof globalThis & {
  __reliai_ops_ingest_repo__?: InMemoryOperationsIngestRepository;
};

export function getOperationsIngestRepo(): OperationsIngestRepository {
  const mode = getOperationsIngestAdapterMode();
  if (mode === "live") {
    return createOperationsIngestRepo("live");
  }
  if (!globalStore.__reliai_ops_ingest_repo__) {
    globalStore.__reliai_ops_ingest_repo__ = new InMemoryOperationsIngestRepository();
  }
  return globalStore.__reliai_ops_ingest_repo__;
}
