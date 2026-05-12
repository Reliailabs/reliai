import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateLifecycleCreateContract } from "@/lib/operations-lifecycle-create";
import { buildOperationsWriteAuditEnvelope } from "@/lib/operations-write-audit-envelope";
import { phase13ErrorResponse, withPhase13Envelope } from "../../../_response";

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

  const result = validateLifecycleCreateContract(payload);
  if (!result.ok) {
    return NextResponse.json(withPhase13Envelope(result), { status: 422 });
  }

  const audit = buildOperationsWriteAuditEnvelope({
    request: {
      event_id: `lifecycle-create-${result.lifecycle_preview.lifecycle_id}`,
      idempotency_key: `lifecycle-create-${result.lifecycle_preview.lifecycle_id}`,
      event_type: "proposal_lifecycle" as const,
      occurred_at: result.request.created_at,
      request_context: {
        organization_id: result.request.organization_id,
        project_id: "none",
        environment_id: "none",
      },
      actor: {
        actor_type: "system",
        actor_id: "lifecycle-validator",
      },
      target: {
        target_type: result.request.target_type,
        target_id: result.request.target_id,
      },
      payload: {
        proposal_id: result.request.proposal_id,
        action_type: result.request.action_type,
        expires_at: result.request.expires_at,
      },
      evidence_refs: result.request.evidence_refs,
    },
    eventFingerprint: result.lifecycle_preview.lifecycle_id,
    requestShapeHash: result.lifecycle_preview.lifecycle_id,
    reason: "lifecycle creation validated in validation-only mode",
  });

  return NextResponse.json(withPhase13Envelope({ ...result, audit_receipt: audit }), { status: 200 });
}
