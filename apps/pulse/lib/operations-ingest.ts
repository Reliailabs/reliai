import { z } from "zod";
import { createHash } from "crypto";

const OPS_EVENT_TYPES = [
  "incident_lifecycle",
  "regression_linkage",
  "proposal_lifecycle",
  "verification_result",
] as const;

const evidenceRefSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const operationsEventIngestSchema = z.object({
  event_id: z.string().min(1),
  idempotency_key: z.string().min(8),
  event_type: z.enum(OPS_EVENT_TYPES),
  occurred_at: z.string().datetime(),
  request_context: z.object({
    organization_id: z.string().min(1),
    project_id: z.string().min(1).nullable(),
    environment_id: z.string().min(1).nullable(),
  }),
  actor: z.object({
    actor_type: z.enum(["human", "system"]),
    actor_id: z.string().min(1),
  }),
  target: z.object({
    target_type: z.enum(["incident", "regression", "proposal", "verification"]),
    target_id: z.string().min(1),
  }),
  payload: z.record(z.string(), z.unknown()),
  evidence_refs: z.array(evidenceRefSchema).min(1),
});

export type OperationsEventIngestRequest = z.infer<typeof operationsEventIngestSchema>;

export type OperationsEventIngestResult =
  | {
      ok: true;
      request: OperationsEventIngestRequest;
      ingest_accepted: true;
      response_class: "accepted_validation";
      event_fingerprint: string;
      request_shape_hash: string;
      immutable_fields: readonly string[];
      warnings: string[];
    }
  | {
      ok: false;
      ingest_accepted: false;
      response_class:
        | "rejected_schema"
        | "rejected_idempotency"
        | "rejected_policy"
        | "rejected_timestamp"
        | "rejected_target_mismatch";
      errors: string[];
      warnings: string[];
    };

export const OPERATIONS_EVENT_IMMUTABLE_FIELDS = [
  "request_context.organization_id",
  "actor",
  "target",
  "evidence_refs",
  "occurred_at",
  "idempotency_key",
] as const;

export function buildOperationsEventFingerprint(input: {
  organization_id: string;
  event_type: (typeof OPS_EVENT_TYPES)[number];
  target_id: string;
  idempotency_key: string;
}): string {
  const key = `${input.organization_id}:${input.event_type}:${input.target_id}:${input.idempotency_key}`;
  return `opsevt-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

export function buildOperationsEventRequestShapeHash(input: {
  event_type: (typeof OPS_EVENT_TYPES)[number];
  target_type: "incident" | "regression" | "proposal" | "verification";
  target_id: string;
  payload: Record<string, unknown>;
}): string {
  const payloadString = JSON.stringify(input.payload, Object.keys(input.payload).sort());
  const key = `${input.event_type}:${input.target_type}:${input.target_id}:${payloadString}`;
  return `opshape-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

function isSafeInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function validateOperationsEventIngest(payload: unknown, now: Date = new Date()): OperationsEventIngestResult {
  const parsed = operationsEventIngestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      ingest_accepted: false,
      response_class: "rejected_schema",
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const occurredAt = new Date(request.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) {
    errors.push("occurred_at is invalid.");
  } else {
    const maxFutureSkewMs = 5 * 60 * 1000;
    if (occurredAt.getTime() - now.getTime() > maxFutureSkewMs) {
      errors.push("occurred_at is too far in the future.");
    }
  }

  for (const ref of request.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }

  if (request.idempotency_key.length < 12) {
    warnings.push("short idempotency_key detected; prefer stable unique keys from source systems.");
  }

  if (request.event_type === "verification_result" && request.target.target_type !== "verification") {
    errors.push("verification_result events must target verification entities.");
  }

  if (errors.length > 0) {
    const response_class =
      errors.some((e) => e.includes("occurred_at"))
        ? "rejected_timestamp"
        : errors.some((e) => e.includes("target"))
          ? "rejected_target_mismatch"
          : errors.some((e) => e.includes("idempotency"))
            ? "rejected_idempotency"
            : errors.some((e) => e.includes("policy"))
              ? "rejected_policy"
              : "rejected_schema";
    return { ok: false, ingest_accepted: false, response_class, errors, warnings };
  }

  return {
    ok: true,
    ingest_accepted: true,
    response_class: "accepted_validation",
    event_fingerprint: buildOperationsEventFingerprint({
      organization_id: request.request_context.organization_id,
      event_type: request.event_type,
      target_id: request.target.target_id,
      idempotency_key: request.idempotency_key,
    }),
    request_shape_hash: buildOperationsEventRequestShapeHash({
      event_type: request.event_type,
      target_type: request.target.target_type,
      target_id: request.target.target_id,
      payload: request.payload,
    }),
    immutable_fields: OPERATIONS_EVENT_IMMUTABLE_FIELDS,
    request,
    warnings,
  };
}
