import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationsWriteAuditEnvelope } from "../lib/operations-write-audit-envelope";

test("builds audit envelope with immutable ingest context", () => {
  const envelope = buildOperationsWriteAuditEnvelope({
    request: {
      event_id: "evt_1",
      idempotency_key: "idem-key-1",
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
        target_id: "inc_1",
      },
      payload: { state: "detected" },
      evidence_refs: [{ label: "Incident", href: "/incidents/inc_1" }],
    },
    eventFingerprint: "opsevt-1234",
    requestShapeHash: "opshape-1234",
    reason: "accepted",
    now: new Date("2026-05-12T12:01:00.000Z"),
  });

  assert.equal(envelope.action, "ingest_validate");
  assert.equal(envelope.after_state.ingest_accepted, true);
  assert.equal(envelope.event_fingerprint, "opsevt-1234");
  assert.equal(envelope.request_shape_hash, "opshape-1234");
  assert.match(envelope.audit_receipt_id, /^ops-audit-/);
});

test("audit receipt id is deterministic for same immutable input", () => {
  const baseInput = {
    request: {
      event_id: "evt_det",
      idempotency_key: "idem-det-1",
      event_type: "incident_lifecycle" as const,
      occurred_at: "2026-05-12T12:00:00.000Z",
      request_context: {
        organization_id: "org_1",
        project_id: "proj_1",
        environment_id: "production",
      },
      actor: {
        actor_type: "system" as const,
        actor_id: "ops-worker",
      },
      target: {
        target_type: "incident" as const,
        target_id: "inc_1",
      },
      payload: { state: "detected" },
      evidence_refs: [{ label: "Incident", href: "/incidents/inc_1" }],
    },
    eventFingerprint: "opsevt-deterministic",
    requestShapeHash: "opshape-deterministic",
    reason: "accepted",
    now: new Date("2026-05-12T12:01:00.000Z"),
  };

  const a = buildOperationsWriteAuditEnvelope(baseInput);
  const b = buildOperationsWriteAuditEnvelope(baseInput);
  assert.equal(a.audit_receipt_id, b.audit_receipt_id);
  assert.deepEqual(a, b);
});

test("audit receipt id changes when immutable receipt key inputs change", () => {
  const one = buildOperationsWriteAuditEnvelope({
    request: {
      event_id: "evt_1",
      idempotency_key: "idem-key-1",
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
        target_id: "inc_1",
      },
      payload: { state: "detected" },
      evidence_refs: [{ label: "Incident", href: "/incidents/inc_1" }],
    },
    eventFingerprint: "opsevt-a",
    requestShapeHash: "opshape-1234",
    reason: "accepted",
    now: new Date("2026-05-12T12:01:00.000Z"),
  });

  const two = buildOperationsWriteAuditEnvelope({
    request: {
      event_id: "evt_1",
      idempotency_key: "idem-key-1",
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
        target_id: "inc_1",
      },
      payload: { state: "detected" },
      evidence_refs: [{ label: "Incident", href: "/incidents/inc_1" }],
    },
    eventFingerprint: "opsevt-b",
    requestShapeHash: "opshape-1234",
    reason: "accepted",
    now: new Date("2026-05-12T12:01:00.000Z"),
  });

  assert.notEqual(one.audit_receipt_id, two.audit_receipt_id);
});
