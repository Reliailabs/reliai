import { getOperationsIngestRepo, type OperationsIngestRecord } from "./operations-ingest-repository";

export type OperationsIntentProjection = {
  ingest_record_id: string;
  accepted_at: string;
  event_id: string;
  event_type: "proposal_lifecycle" | "verification_result";
  target_id: string;
  organization_id: string;
  proposal_id: string | null;
  lifecycle_id: string | null;
  outcome: "passed" | "failed" | "inconclusive" | null;
};

function byAcceptedAtDesc(a: OperationsIngestRecord, b: OperationsIngestRecord): number {
  return new Date(b.accepted_at).getTime() - new Date(a.accepted_at).getTime();
}

function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function payloadOutcome(payload: unknown): "passed" | "failed" | "inconclusive" | null {
  const value = payloadString(payload, "outcome");
  if (value === "passed" || value === "failed" || value === "inconclusive") return value;
  return null;
}

export function getRecentLifecycleIntents(limit = 20): OperationsIntentProjection[] {
  const repo = getOperationsIngestRepo();
  return repo
    .findAll({ event_type: "proposal_lifecycle" })
    .sort(byAcceptedAtDesc)
    .slice(0, limit)
    .map((record) => ({
      ingest_record_id: record.ingest_record_id,
      accepted_at: record.accepted_at,
      event_id: record.event.event_id,
      event_type: record.event.event_type,
      target_id: record.event.target.target_id,
      organization_id: record.event.request_context.organization_id,
      proposal_id:
        payloadString(record.event.payload, "proposal_id") ??
        (record.event.target.target_type === "proposal" ? record.event.target.target_id : null),
      lifecycle_id: payloadString(record.event.payload, "lifecycle_id"),
      outcome: payloadOutcome(record.event.payload),
    }));
}

export function getRecentVerificationIntents(limit = 20): OperationsIntentProjection[] {
  const repo = getOperationsIngestRepo();
  return repo
    .findAll({ event_type: "verification_result" })
    .sort(byAcceptedAtDesc)
    .slice(0, limit)
    .map((record) => ({
      ingest_record_id: record.ingest_record_id,
      accepted_at: record.accepted_at,
      event_id: record.event.event_id,
      event_type: record.event.event_type,
      target_id: record.event.target.target_id,
      organization_id: record.event.request_context.organization_id,
      proposal_id: payloadString(record.event.payload, "proposal_id"),
      lifecycle_id: payloadString(record.event.payload, "lifecycle_id"),
      outcome: payloadOutcome(record.event.payload),
    }));
}
