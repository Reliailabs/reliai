import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { getOperationsIngestRepo } from "@/lib/operations-ingest-repository";
import { validateVerificationWriteContract } from "@/lib/operations-verification-write";
import { buildOperationsWriteAuditEnvelope } from "@/lib/operations-write-audit-envelope";
import {
  phase13ErrorResponse,
  phase13RejectedPolicyResponse,
  phase13ValidationRejectionResponse,
  withPhase13Envelope,
} from "../../../_response";

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

  const result = validateVerificationWriteContract(payload);
  if (!result.ok) {
    return phase13ValidationRejectionResponse(result, 422);
  }

  try {
    const ingestRepo = getOperationsIngestRepo();
    ingestRepo.append({
      ingest_record_id: `ing-verification-${result.request.verification_result_id}`,
      accepted_at: new Date().toISOString(),
      event_fingerprint: `${result.request.lifecycle_id}:${result.request.verification_result_id}`,
      request_shape_hash: `${result.request.proposal_id}:${result.request.outcome}`,
      event: {
        event_id: `verification-write-${result.request.verification_result_id}`,
        idempotency_key: `verification-write-${result.request.verification_result_id}`,
        event_type: "verification_result",
        occurred_at: result.request.verified_at,
        request_context: {
          organization_id: result.request.organization_id,
          project_id: "none",
          environment_id: "none",
        },
        actor: {
          actor_type: "system",
          actor_id: "verification-write-validator",
        },
        target: {
          target_type: "verification",
          target_id: result.request.verification_result_id,
        },
        payload: {
          lifecycle_id: result.request.lifecycle_id,
          proposal_id: result.request.proposal_id,
          outcome: result.request.outcome,
        },
        evidence_refs: result.request.evidence_refs,
      },
    });
  } catch {
    return phase13RejectedPolicyResponse(
      { verification_write_accepted: false },
      "verification-write persistence backend unavailable",
    );
  }

  const audit = buildOperationsWriteAuditEnvelope({
    request: {
      event_id: `verification-write-${result.request.verification_result_id}`,
      idempotency_key: `verification-write-${result.request.verification_result_id}`,
      event_type: "verification_result" as const,
      occurred_at: result.request.verified_at,
      request_context: {
        organization_id: result.request.organization_id,
        project_id: "none",
        environment_id: "none",
      },
      actor: {
        actor_type: "system",
        actor_id: "verification-write-validator",
      },
      target: {
        target_type: "verification",
        target_id: result.request.verification_result_id,
      },
      payload: {
        lifecycle_id: result.request.lifecycle_id,
        proposal_id: result.request.proposal_id,
        outcome: result.request.outcome,
      },
      evidence_refs: result.request.evidence_refs,
    },
    eventFingerprint: `${result.request.lifecycle_id}:${result.request.verification_result_id}`,
    requestShapeHash: `${result.request.proposal_id}:${result.request.outcome}`,
    reason: "verification write intent validated in non-executing mode",
  });

  return NextResponse.json(withPhase13Envelope({ ...result, audit_receipt: audit }), { status: 200 });
}
