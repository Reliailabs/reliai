import { NextResponse } from "next/server";
import { evaluateRetryPolicy } from "@/lib/operations-retry-policy";

export const PHASE13_RESPONSE_CLASS = {
  acceptedValidation: "accepted_validation",
  acceptedDuplicate: "accepted_duplicate",
  rejectedSchema: "rejected_schema",
  rejectedIdempotency: "rejected_idempotency",
  rejectedPolicy: "rejected_policy",
  rejectedTimestamp: "rejected_timestamp",
  rejectedTargetMismatch: "rejected_target_mismatch",
  rejectedTransition: "rejected_transition",
} as const;

export const PHASE13_INGEST_CONTRACT = {
  contract_version: "phase13-v1",
  mode: "validation_only",
  execution_granted: false,
} as const;

type Envelope = typeof PHASE13_INGEST_CONTRACT;
type Result<T extends object> = Envelope & T;

export function withPhase13Envelope<T extends object>(payload: T): Result<T> {
  return {
    ...PHASE13_INGEST_CONTRACT,
    ...payload,
  };
}

function buildPhase13JsonResponse<T extends object>(payload: T, status: number) {
  return NextResponse.json(withPhase13Envelope(payload), { status });
}

export function phase13ErrorResponse(status: 400 | 401, message: string) {
  const responseClass = status === 400 ? PHASE13_RESPONSE_CLASS.rejectedSchema : PHASE13_RESPONSE_CLASS.rejectedPolicy;
  return buildPhase13JsonResponse(
    {
      ok: false as const,
      ingest_accepted: false as const,
      create_accepted: false as const,
      transition_accepted: false as const,
      verification_write_accepted: false as const,
      response_class: responseClass,
      errors: [message],
      warnings: [],
      retry_policy: evaluateRetryPolicy({ attempt: 1, responseClass }),
    },
    status,
  );
}

type RejectedPolicyAcceptedFlags = {
  ingest_accepted?: false;
  create_accepted?: false;
  transition_accepted?: false;
  verification_write_accepted?: false;
};

type ValidationRejectionPayload = {
  ok: false;
  response_class:
    | typeof PHASE13_RESPONSE_CLASS.rejectedSchema
    | typeof PHASE13_RESPONSE_CLASS.rejectedIdempotency
    | typeof PHASE13_RESPONSE_CLASS.rejectedPolicy
    | typeof PHASE13_RESPONSE_CLASS.rejectedTimestamp
    | typeof PHASE13_RESPONSE_CLASS.rejectedTargetMismatch
    | typeof PHASE13_RESPONSE_CLASS.rejectedTransition;
  errors: string[];
  warnings: string[];
};

type AcceptedDuplicateResponseParams = {
  warningMessage: string;
  duplicateOfEventId: string;
  eventFingerprint: string;
  requestShapeHash: string;
  auditReceipt: object;
};

export function phase13ValidationRejectionResponse<T extends ValidationRejectionPayload>(payload: T, status = 422) {
  return buildPhase13JsonResponse(
    {
      ...payload,
      retry_policy: evaluateRetryPolicy({ attempt: 1, responseClass: payload.response_class }),
    },
    status,
  );
}

export function phase13AcceptedDuplicateResponse(params: AcceptedDuplicateResponseParams) {
  return buildPhase13JsonResponse(
    {
      ok: true as const,
      ingest_accepted: true as const,
      response_class: PHASE13_RESPONSE_CLASS.acceptedDuplicate,
      warnings: [params.warningMessage],
      duplicate_of_event_id: params.duplicateOfEventId,
      event_fingerprint: params.eventFingerprint,
      request_shape_hash: params.requestShapeHash,
      audit_receipt: params.auditReceipt,
    },
    200,
  );
}

export function phase13AcceptedValidationResponse<T extends { ok: true }>(result: T, auditReceipt: object) {
  return buildPhase13JsonResponse(
    {
      ...result,
      audit_receipt: auditReceipt,
    },
    200,
  );
}

export function phase13RejectedIdempotencyResponse(params: {
  message: string;
  duplicateOfEventId: string;
  eventFingerprint: string;
}) {
  return buildPhase13JsonResponse(
    {
      ok: false as const,
      ingest_accepted: false as const,
      response_class: PHASE13_RESPONSE_CLASS.rejectedIdempotency,
      errors: [params.message],
      warnings: [],
      duplicate_of_event_id: params.duplicateOfEventId,
      event_fingerprint: params.eventFingerprint,
      retry_policy: evaluateRetryPolicy({ attempt: 1, responseClass: PHASE13_RESPONSE_CLASS.rejectedIdempotency }),
    },
    409,
  );
}

export function phase13RejectedPolicyResponse(
  acceptedFlags: RejectedPolicyAcceptedFlags,
  message: string,
  status = 503,
) {
  return buildPhase13JsonResponse(
    {
      ok: false as const,
      response_class: PHASE13_RESPONSE_CLASS.rejectedPolicy,
      errors: [message],
      warnings: [],
      retry_policy: evaluateRetryPolicy({ attempt: 1, responseClass: PHASE13_RESPONSE_CLASS.rejectedPolicy }),
      ...acceptedFlags,
    },
    status,
  );
}
