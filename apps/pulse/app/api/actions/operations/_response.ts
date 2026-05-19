import { NextResponse } from "next/server";
import { evaluateRetryPolicy } from "@/lib/operations-retry-policy";
import type { RetryEvaluationInput } from "@/lib/operations-retry-policy";

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

type Phase13ResponseClass = (typeof PHASE13_RESPONSE_CLASS)[keyof typeof PHASE13_RESPONSE_CLASS];

export const PHASE13_HTTP_STATUS = {
  accepted: 200,
  validationRejected: 422,
  idempotencyRejected: 409,
  unauthorized: 401,
  invalidRequest: 400,
  policyRejected: 503,
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

function withRetryPolicy<T extends { response_class: Phase13ResponseClass }>(payload: T, attempt = 1) {
  return {
    ...payload,
    retry_policy: evaluateRetryPolicy({
      attempt,
      responseClass: payload.response_class as RetryEvaluationInput["responseClass"],
    }),
  };
}

export function phase13ErrorResponse(status: 400 | 401, message: string) {
  const responseClass = status === 400 ? PHASE13_RESPONSE_CLASS.rejectedSchema : PHASE13_RESPONSE_CLASS.rejectedPolicy;
  return buildPhase13JsonResponse(
    withRetryPolicy({
      ok: false as const,
      ingest_accepted: false as const,
      create_accepted: false as const,
      transition_accepted: false as const,
      verification_write_accepted: false as const,
      response_class: responseClass,
      errors: [message],
      warnings: [],
    }),
    status,
  );
}

type RejectedPolicyAcceptedFlags = {
  ingest_accepted?: false;
  create_accepted?: false;
  transition_accepted?: false;
  verification_write_accepted?: false;
};

type Phase13RejectedResponseClass =
  | typeof PHASE13_RESPONSE_CLASS.rejectedSchema
  | typeof PHASE13_RESPONSE_CLASS.rejectedIdempotency
  | typeof PHASE13_RESPONSE_CLASS.rejectedPolicy
  | typeof PHASE13_RESPONSE_CLASS.rejectedTimestamp
  | typeof PHASE13_RESPONSE_CLASS.rejectedTargetMismatch
  | typeof PHASE13_RESPONSE_CLASS.rejectedTransition;

type ValidationRejectionPayload = {
  ok: false;
  response_class: Phase13RejectedResponseClass;
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
  if (!payload.response_class.startsWith("rejected_")) {
    throw new Error(`Invalid rejection response_class: ${payload.response_class}`);
  }
  return buildPhase13JsonResponse(
    withRetryPolicy(payload),
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
    PHASE13_HTTP_STATUS.accepted,
  );
}

export function phase13AcceptedValidationResponse<T extends { ok: true }>(result: T, auditReceipt: object) {
  return buildPhase13JsonResponse(
    {
      ...result,
      audit_receipt: auditReceipt,
    },
    PHASE13_HTTP_STATUS.accepted,
  );
}

export function phase13RejectedIdempotencyResponse(params: {
  message: string;
  duplicateOfEventId: string;
  eventFingerprint: string;
}) {
  return buildPhase13JsonResponse(
    withRetryPolicy({
      ok: false as const,
      ingest_accepted: false as const,
      response_class: PHASE13_RESPONSE_CLASS.rejectedIdempotency,
      errors: [params.message],
      warnings: [],
      duplicate_of_event_id: params.duplicateOfEventId,
      event_fingerprint: params.eventFingerprint,
    }),
    PHASE13_HTTP_STATUS.idempotencyRejected,
  );
}

export function phase13RejectedPolicyResponse(
  acceptedFlags: RejectedPolicyAcceptedFlags,
  message: string,
  status = PHASE13_HTTP_STATUS.policyRejected,
) {
  return buildPhase13JsonResponse(
    withRetryPolicy({
      ok: false as const,
      response_class: PHASE13_RESPONSE_CLASS.rejectedPolicy,
      errors: [message],
      warnings: [],
      ...acceptedFlags,
    }),
    status,
  );
}
