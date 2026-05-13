import { getOperationsIngestRepo, type OperationsIngestRecord } from "./operations-ingest-repository";

export type OperationsIntentProjection = {
  ingest_record_id: string;
  accepted_at: string;
  event_id: string;
  event_type: "proposal_lifecycle" | "verification_result";
  target_id: string;
  organization_id: string;
};

function byAcceptedAtDesc(a: OperationsIngestRecord, b: OperationsIngestRecord): number {
  return new Date(b.accepted_at).getTime() - new Date(a.accepted_at).getTime();
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
    }));
}
