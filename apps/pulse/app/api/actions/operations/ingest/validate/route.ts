import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateOperationsEventIngest } from "@/lib/operations-ingest";
import { checkOperationsEventDuplicate, recordOperationsEventFingerprint } from "@/lib/operations-ingest-dedup";
import { getOperationsIngestRepo } from "@/lib/operations-ingest-repository";
import { evaluateRetryPolicy } from "@/lib/operations-retry-policy";
import { buildOperationsWriteAuditEnvelope } from "@/lib/operations-write-audit-envelope";
import {
  phase13AcceptedDuplicateResponse,
  phase13ErrorResponse,
  phase13RejectedIdempotencyResponse,
  phase13RejectedPolicyResponse,
  phase13ValidationRejectionResponse,
  withPhase13Envelope,
} from "../../_response";

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return phase13ErrorResponse(401, "unauthorized");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return phase13ErrorResponse(400, "invalid JSON body");
  }

  const result = validateOperationsEventIngest(payload);
  if (!result.ok) {
    return phase13ValidationRejectionResponse(result, 422);
  }

  const dedup = checkOperationsEventDuplicate(
    result.event_fingerprint,
    result.request.idempotency_key,
    result.request_shape_hash,
  );
  if (dedup.status === "accepted_duplicate") {
    const audit = buildOperationsWriteAuditEnvelope({
      request: result.request,
      eventFingerprint: result.event_fingerprint,
      requestShapeHash: result.request_shape_hash,
      reason: "duplicate replay accepted",
    });
    return phase13AcceptedDuplicateResponse({
      warningMessage: "duplicate replay accepted",
      duplicateOfEventId: dedup.record.eventId,
      eventFingerprint: result.event_fingerprint,
      requestShapeHash: result.request_shape_hash,
      auditReceipt: audit,
    });
  }
  if (dedup.status === "rejected_idempotency") {
    return phase13RejectedIdempotencyResponse({
      message: "idempotency key replay with changed event semantics",
      duplicateOfEventId: dedup.record.eventId,
      eventFingerprint: result.event_fingerprint,
    });
  }

  recordOperationsEventFingerprint(
    result.event_fingerprint,
    result.request.idempotency_key,
    result.request_shape_hash,
    result.request.event_id,
  );

  try {
    const ingestRepo = getOperationsIngestRepo();
    ingestRepo.append({
      ingest_record_id: `ing-${result.request.event_id}`,
      accepted_at: new Date().toISOString(),
      event_fingerprint: result.event_fingerprint,
      request_shape_hash: result.request_shape_hash,
      event: result.request,
    });
  } catch {
    return phase13RejectedPolicyResponse({ ingest_accepted: false }, "ingest persistence backend unavailable");
  }

  const audit = buildOperationsWriteAuditEnvelope({
    request: result.request,
    eventFingerprint: result.event_fingerprint,
    requestShapeHash: result.request_shape_hash,
    reason: "ingest event accepted in validation-only mode",
  });

  return NextResponse.json(withPhase13Envelope({ ...result, audit_receipt: audit }), { status: 200 });
}
