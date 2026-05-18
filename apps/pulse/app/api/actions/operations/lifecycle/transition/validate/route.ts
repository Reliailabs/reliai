import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { getOperationsIngestRepo } from "@/lib/operations-ingest-repository";
import { validateLifecycleTransitionIntent } from "@/lib/operations-lifecycle-transition-intent";
import { evaluateRetryPolicy } from "@/lib/operations-retry-policy";
import { buildOperationsWriteAuditEnvelope } from "@/lib/operations-write-audit-envelope";
import { phase13ErrorResponse, phase13RejectedPolicyResponse, withPhase13Envelope } from "../../../_response";

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

  const result = validateLifecycleTransitionIntent(payload);
  if (!result.ok) {
    return NextResponse.json(
      withPhase13Envelope({
        ...result,
        retry_policy: evaluateRetryPolicy({ attempt: 1, responseClass: result.response_class }),
      }),
      { status: 422 },
    );
  }

  try {
    const ingestRepo = getOperationsIngestRepo();
    ingestRepo.append({
      ingest_record_id: `ing-lifecycle-transition-${result.request.lifecycle_id}-${result.request.to_state}`,
      accepted_at: new Date().toISOString(),
      event_fingerprint: `${result.request.lifecycle_id}:${result.request.from_state}:${result.request.to_state}`,
      request_shape_hash: `${result.request.lifecycle_id}:${result.request.to_state}`,
      event: {
        event_id: `lifecycle-transition-${result.request.lifecycle_id}`,
        idempotency_key: `lifecycle-transition-${result.request.lifecycle_id}:${result.request.to_state}`,
        event_type: "proposal_lifecycle",
        occurred_at: result.request.proposed_at,
        request_context: {
          organization_id: result.request.organization_id,
          project_id: "none",
          environment_id: "none",
        },
        actor: {
          actor_type: "system",
          actor_id: "lifecycle-transition-validator",
        },
        target: {
          target_type: "proposal",
          target_id: result.request.lifecycle_id,
        },
        payload: {
          from_state: result.request.from_state,
          to_state: result.request.to_state,
          reason: result.request.reason ?? null,
        },
        evidence_refs: result.request.evidence_refs,
      },
    });
  } catch {
    return phase13RejectedPolicyResponse(
      { transition_accepted: false },
      "lifecycle-transition persistence backend unavailable",
    );
  }

  const audit = buildOperationsWriteAuditEnvelope({
    request: {
      event_id: `lifecycle-transition-${result.transition_intent.lifecycle_id}`,
      idempotency_key: `lifecycle-transition-${result.transition_intent.lifecycle_id}`,
      event_type: "proposal_lifecycle" as const,
      occurred_at: result.request.proposed_at,
      request_context: {
        organization_id: result.request.organization_id,
        project_id: "none",
        environment_id: "none",
      },
      actor: {
        actor_type: "system",
        actor_id: "lifecycle-transition-validator",
      },
      target: {
        target_type: "proposal",
        target_id: result.request.lifecycle_id,
      },
      payload: {
        from_state: result.request.from_state,
        to_state: result.request.to_state,
        reason: result.request.reason ?? null,
      },
      evidence_refs: result.request.evidence_refs,
    },
    eventFingerprint: `${result.request.lifecycle_id}:${result.request.from_state}:${result.request.to_state}`,
    requestShapeHash: `${result.request.lifecycle_id}:${result.request.to_state}`,
    reason: "lifecycle transition intent validated in non-executing mode",
  });

  return NextResponse.json(withPhase13Envelope({ ...result, audit_receipt: audit }), { status: 200 });
}
