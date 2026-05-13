import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendOperationsIngestRepository,
  createOperationsIngestRepo,
  getOperationsIngestRepo,
  InMemoryOperationsIngestRepository,
} from "../lib/operations-ingest-repository";

const sampleRecord = {
  ingest_record_id: "ing_1",
  accepted_at: "2026-05-12T12:00:00.000Z",
  event_fingerprint: "opsevt-1",
  request_shape_hash: "opshape-1",
  event: {
    event_id: "evt_1",
    idempotency_key: "idem-key-1",
    event_type: "incident_lifecycle" as const,
    occurred_at: "2026-05-12T11:59:00.000Z",
    request_context: {
      organization_id: "org_1",
      project_id: "proj_1",
      environment_id: "production",
    },
    actor: {
      actor_type: "system" as const,
      actor_id: "worker",
    },
    target: {
      target_type: "incident" as const,
      target_id: "inc_1",
    },
    payload: { state: "detected" },
    evidence_refs: [{ label: "Incident", href: "/incidents/inc_1" }],
  },
};

test("in-memory ingest repository appends and queries by fingerprint/idempotency", () => {
  const repo = new InMemoryOperationsIngestRepository();
  repo.append(sampleRecord);
  assert.equal(repo.findByFingerprint("opsevt-1")?.event.event_id, "evt_1");
  assert.equal(repo.findByIdempotencyKey("idem-key-1")?.event.event_id, "evt_1");
});

test("createOperationsIngestRepo returns fixture adapter in fixture mode", () => {
  const repo = createOperationsIngestRepo("fixture");
  assert.ok(repo instanceof InMemoryOperationsIngestRepository);
});

test("createOperationsIngestRepo returns backend stub in live mode", () => {
  const repo = createOperationsIngestRepo("live");
  assert.ok(repo instanceof BackendOperationsIngestRepository);
});

test("getOperationsIngestRepo returns shared fixture repo by default", () => {
  const repoA = getOperationsIngestRepo();
  const repoB = getOperationsIngestRepo();
  assert.ok(repoA instanceof InMemoryOperationsIngestRepository);
  assert.equal(repoA, repoB);
});
