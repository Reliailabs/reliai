import assert from "node:assert/strict";
import test from "node:test";

import { PHASE13_INGEST_CONTRACT, withPhase13Envelope } from "../app/api/actions/operations/_response";
import { buildOperationsEventFingerprint, validateOperationsEventIngest } from "../lib/operations-ingest";

const basePayload = {
  event_id: "evt_01",
  idempotency_key: "idem-key-000001",
  event_type: "incident_lifecycle",
  occurred_at: "2026-05-12T12:00:00.000Z",
  request_context: {
    organization_id: "org_1",
    project_id: "proj_1",
    environment_id: "production",
  },
  actor: {
    actor_type: "system",
    actor_id: "ops-worker",
  },
  target: {
    target_type: "incident",
    target_id: "inc_001",
  },
  payload: {
    state: "detected",
  },
  evidence_refs: [{ label: "Incident detail", href: "/operations/incidents/inc_001" }],
} as const;

test("accepts valid operations ingest event", () => {
  const result = validateOperationsEventIngest(basePayload, new Date("2026-05-12T12:01:00.000Z"));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.ingest_accepted, true);
    assert.equal(result.response_class, "accepted_validation");
    assert.match(result.event_fingerprint, /^opsevt-/);
    assert.ok(result.immutable_fields.includes("idempotency_key"));
  }
});

test("rejects external evidence href", () => {
  const result = validateOperationsEventIngest(
    {
      ...basePayload,
      evidence_refs: [{ label: "Bad", href: "https://example.com" }],
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_schema");
  }
});

test("rejects verification event with wrong target", () => {
  const result = validateOperationsEventIngest(
    {
      ...basePayload,
      event_type: "verification_result",
      target: {
        target_type: "incident",
        target_id: "inc_001",
      },
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_target_mismatch");
  }
});

test("phase 13 envelope remains validation-only", () => {
  assert.equal(PHASE13_INGEST_CONTRACT.contract_version, "phase13-v1");
  assert.equal(PHASE13_INGEST_CONTRACT.mode, "validation_only");
  assert.equal(PHASE13_INGEST_CONTRACT.execution_granted, false);
});

test("phase 13 envelope helper injects contract metadata", () => {
  const response = withPhase13Envelope({ ok: true as const, ingest_accepted: true as const, warnings: [] });
  assert.equal(response.contract_version, "phase13-v1");
  assert.equal(response.mode, "validation_only");
  assert.equal(response.execution_granted, false);
});

test("fingerprint is deterministic for same tuple", () => {
  const a = buildOperationsEventFingerprint({
    organization_id: "org_1",
    event_type: "incident_lifecycle",
    target_id: "inc_001",
    idempotency_key: "idem-key-000001",
  });
  const b = buildOperationsEventFingerprint({
    organization_id: "org_1",
    event_type: "incident_lifecycle",
    target_id: "inc_001",
    idempotency_key: "idem-key-000001",
  });
  assert.equal(a, b);
});
