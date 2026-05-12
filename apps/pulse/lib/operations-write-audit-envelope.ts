import { createHash } from "crypto";

import type { OperationsEventIngestRequest } from "@/lib/operations-ingest";

export type OperationsWriteAuditEnvelope = {
  audit_receipt_id: string;
  action: "ingest_validate";
  actor: {
    actor_type: "human" | "system";
    actor_id: string;
  };
  target: {
    target_type: "incident" | "regression" | "proposal" | "verification";
    target_id: string;
  };
  reason: string;
  event_id: string;
  idempotency_key: string;
  event_fingerprint: string;
  request_shape_hash: string;
  evidence_refs: Array<{ label: string; href: string }>;
  before_state: null;
  after_state: { ingest_accepted: true };
  created_at: string;
};

export function buildOperationsWriteAuditEnvelope(input: {
  request: OperationsEventIngestRequest;
  eventFingerprint: string;
  requestShapeHash: string;
  reason: string;
  now?: Date;
}): OperationsWriteAuditEnvelope {
  const createdAt = (input.now ?? new Date()).toISOString();
  const receiptKey = `${input.request.event_id}:${input.eventFingerprint}:${createdAt}`;
  const auditReceiptId = `ops-audit-${createHash("sha256").update(receiptKey).digest("hex").slice(0, 16)}`;

  return {
    audit_receipt_id: auditReceiptId,
    action: "ingest_validate",
    actor: {
      actor_type: input.request.actor.actor_type,
      actor_id: input.request.actor.actor_id,
    },
    target: {
      target_type: input.request.target.target_type,
      target_id: input.request.target.target_id,
    },
    reason: input.reason,
    event_id: input.request.event_id,
    idempotency_key: input.request.idempotency_key,
    event_fingerprint: input.eventFingerprint,
    request_shape_hash: input.requestShapeHash,
    evidence_refs: input.request.evidence_refs.map((ref) => ({ label: ref.label, href: ref.href })),
    before_state: null,
    after_state: { ingest_accepted: true },
    created_at: createdAt,
  };
}
