import { getOperatorSession } from "@/lib/auth";
import { getOperationsIngestRepo } from "@/lib/operations-ingest-repository";
import { validateLifecycleCreateContract } from "@/lib/operations-lifecycle-create";
import { buildOperationsWriteAuditEnvelope } from "@/lib/operations-write-audit-envelope";
import {
  phase13AcceptedValidationResponse,
  phase13ErrorResponse,
  phase13RejectedPolicyResponse,
  phase13ValidationRejectionResponse,
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

  const result = validateLifecycleCreateContract(payload);
  if (!result.ok) {
    return phase13ValidationRejectionResponse(result, 422);
  }

  try {
    const ingestRepo = getOperationsIngestRepo();
    ingestRepo.append({
      ingest_record_id: `ing-lifecycle-create-${result.lifecycle_preview.lifecycle_id}`,
      accepted_at: new Date().toISOString(),
      event_fingerprint: result.lifecycle_preview.lifecycle_id,
      request_shape_hash: `lifecycle-create:${result.request.proposal_id}`,
      event: {
        event_id: `lifecycle-create-${result.lifecycle_preview.lifecycle_id}`,
        idempotency_key: `lifecycle-create-${result.lifecycle_preview.lifecycle_id}`,
        event_type: "proposal_lifecycle",
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
          target_type: "proposal",
          target_id: result.request.proposal_id,
        },
        payload: {
          action_type: result.request.action_type,
          target_type: result.request.target_type,
          target_id: result.request.target_id,
          expires_at: result.request.expires_at,
        },
        evidence_refs: result.request.evidence_refs,
      },
    });
  } catch {
    return phase13RejectedPolicyResponse(
      { create_accepted: false },
      "lifecycle-create persistence backend unavailable",
    );
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

  return phase13AcceptedValidationResponse(result, audit);
}
