import assert from "node:assert/strict";
import test from "node:test";

import { checkOperationsEventDuplicate, recordOperationsEventFingerprint } from "../lib/operations-ingest-dedup";
import { buildOperationsEventFingerprint, buildOperationsEventRequestShapeHash } from "../lib/operations-ingest";

const base = {
  organization_id: "org_1",
  event_type: "incident_lifecycle" as const,
  target_type: "incident" as const,
  target_id: "inc_1",
  idempotency_key: "idem-key-0001",
  payload: { state: "detected" },
};

test("same fingerprint + same payload => accepted duplicate", () => {
  const fingerprint = buildOperationsEventFingerprint(base);
  const shape = buildOperationsEventRequestShapeHash(base);

  const first = checkOperationsEventDuplicate(fingerprint, base.idempotency_key, shape);
  assert.equal(first.status, "new");
  recordOperationsEventFingerprint(fingerprint, base.idempotency_key, shape, "evt_1");

  const second = checkOperationsEventDuplicate(fingerprint, base.idempotency_key, shape);
  assert.equal(second.status, "accepted_duplicate");
});

test("same key + changed payload => rejected idempotency", () => {
  const fpA = buildOperationsEventFingerprint(base);
  const shapeA = buildOperationsEventRequestShapeHash(base);
  recordOperationsEventFingerprint(fpA, base.idempotency_key, shapeA, "evt_2");

  const changed = { ...base, payload: { state: "analyzed" } };
  const fpB = buildOperationsEventFingerprint(changed);
  const shapeB = buildOperationsEventRequestShapeHash(changed);

  const res = checkOperationsEventDuplicate(fpB, changed.idempotency_key, shapeB);
  assert.equal(res.status, "rejected_idempotency");
});

test("same key + changed target => rejected idempotency", () => {
  const seeded = {
    ...base,
    idempotency_key: "idem-key-0002",
  };
  const fpSeed = buildOperationsEventFingerprint(seeded);
  const shapeSeed = buildOperationsEventRequestShapeHash(seeded);
  recordOperationsEventFingerprint(fpSeed, seeded.idempotency_key, shapeSeed, "evt_3");

  const changedTarget = { ...seeded, target_id: "inc_2" };
  const fp = buildOperationsEventFingerprint(changedTarget);
  const shape = buildOperationsEventRequestShapeHash(changedTarget);
  const res = checkOperationsEventDuplicate(fp, changedTarget.idempotency_key, shape);
  assert.equal(res.status, "rejected_idempotency");
});

test("same key + changed event type => rejected idempotency", () => {
  const seeded = {
    ...base,
    idempotency_key: "idem-key-0003",
  };
  const fpSeed = buildOperationsEventFingerprint(seeded);
  const shapeSeed = buildOperationsEventRequestShapeHash(seeded);
  recordOperationsEventFingerprint(fpSeed, seeded.idempotency_key, shapeSeed, "evt_4");

  const changedType = { ...seeded, event_type: "proposal_lifecycle" as const };
  const fp = buildOperationsEventFingerprint(changedType);
  const shape = buildOperationsEventRequestShapeHash(changedType);
  const res = checkOperationsEventDuplicate(fp, changedType.idempotency_key, shape);
  assert.equal(res.status, "rejected_idempotency");
});
