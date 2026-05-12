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
