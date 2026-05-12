type DedupRecord = {
  fingerprint: string;
  idempotencyKey: string;
  requestShapeHash: string;
  eventId: string;
  acceptedAt: string;
};

const seenByFingerprint = new Map<string, DedupRecord>();
const seenByIdempotencyKey = new Map<string, DedupRecord>();

export type DedupResult =
  | { status: "new" }
  | { status: "accepted_duplicate"; record: DedupRecord }
  | { status: "rejected_idempotency"; record: DedupRecord };

export function checkOperationsEventDuplicate(
  fingerprint: string,
  idempotencyKey: string,
  requestShapeHash: string,
): DedupResult {
  const byFingerprint = seenByFingerprint.get(fingerprint);
  if (byFingerprint) {
    if (byFingerprint.requestShapeHash === requestShapeHash) {
      return { status: "accepted_duplicate", record: byFingerprint };
    }
    return { status: "rejected_idempotency", record: byFingerprint };
  }

  const byIdempotency = seenByIdempotencyKey.get(idempotencyKey);
  if (!byIdempotency) return { status: "new" };
  if (byIdempotency.requestShapeHash === requestShapeHash) {
    return { status: "accepted_duplicate", record: byIdempotency };
  }
  return { status: "rejected_idempotency", record: byIdempotency };
}

export function recordOperationsEventFingerprint(
  fingerprint: string,
  idempotencyKey: string,
  requestShapeHash: string,
  eventId: string,
): DedupRecord {
  const record: DedupRecord = {
    fingerprint,
    idempotencyKey,
    requestShapeHash,
    eventId,
    acceptedAt: new Date().toISOString(),
  };
  seenByFingerprint.set(fingerprint, record);
  seenByIdempotencyKey.set(idempotencyKey, record);
  return record;
}
