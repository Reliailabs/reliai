import assert from "node:assert/strict";
import test from "node:test";

import { getOperationsIngestRepo } from "../lib/operations-ingest-repository";
import { getRecentLifecycleIntents, getRecentVerificationIntents } from "../lib/operations-ingest-projections";

function appendLifecycle(repo: ReturnType<typeof getOperationsIngestRepo>, suffix: string, acceptedAt: string) {
  repo.append({
    ingest_record_id: `ing-lifecycle-${suffix}`,
    accepted_at: acceptedAt,
    event_fingerprint: `fp-lifecycle-${suffix}`,
    request_shape_hash: `shape-lifecycle-${suffix}`,
    event: {
      event_id: `evt-lifecycle-${suffix}`,
      idempotency_key: `idem-lifecycle-${suffix}`,
      event_type: "proposal_lifecycle",
      occurred_at: acceptedAt,
      request_context: { organization_id: "org_test", project_id: "none", environment_id: "none" },
      actor: { actor_type: "system", actor_id: "test" },
      target: { target_type: "proposal", target_id: `proposal-${suffix}` },
      payload: {},
      evidence_refs: [{ label: "Test", href: "/operations" }],
    },
  });
}

function appendVerification(repo: ReturnType<typeof getOperationsIngestRepo>, suffix: string, acceptedAt: string) {
  repo.append({
    ingest_record_id: `ing-verify-${suffix}`,
    accepted_at: acceptedAt,
    event_fingerprint: `fp-verify-${suffix}`,
    request_shape_hash: `shape-verify-${suffix}`,
    event: {
      event_id: `evt-verify-${suffix}`,
      idempotency_key: `idem-verify-${suffix}`,
      event_type: "verification_result",
      occurred_at: acceptedAt,
      request_context: { organization_id: "org_test", project_id: "none", environment_id: "none" },
      actor: { actor_type: "system", actor_id: "test" },
      target: { target_type: "verification", target_id: `verification-${suffix}` },
      payload: {
        lifecycle_id: `lifecycle-${suffix}`,
        proposal_id: `proposal-${suffix}`,
        outcome: "passed",
      },
      evidence_refs: [{ label: "Test", href: "/operations" }],
    },
  });
}

test("projections return recently appended lifecycle and verification intents", () => {
  const repo = getOperationsIngestRepo();
  const suffix = Date.now().toString();

  appendLifecycle(repo, suffix, new Date().toISOString());
  appendVerification(repo, suffix, new Date().toISOString());

  const lifecycle = getRecentLifecycleIntents(50);
  const verification = getRecentVerificationIntents(50);

  assert.ok(lifecycle.some((item) => item.event_id === `evt-lifecycle-${suffix}`));
  assert.ok(verification.some((item) => item.event_id === `evt-verify-${suffix}`));
});

test("verification projections preserve proposal/lifecycle consistency links", () => {
  const repo = getOperationsIngestRepo();
  const suffix = `${Date.now()}-consistency`;
  appendVerification(repo, suffix, new Date().toISOString());

  const projection = getRecentVerificationIntents(200).find((item) => item.event_id === `evt-verify-${suffix}`);
  assert.ok(projection);
  assert.equal(projection?.proposal_id, `proposal-${suffix}`);
  assert.equal(projection?.lifecycle_id, `lifecycle-${suffix}`);
  assert.equal(projection?.outcome, "passed");
});

test("projections enforce event-type filtering", () => {
  const repo = getOperationsIngestRepo();
  const suffix = `${Date.now()}-filter`;
  appendLifecycle(repo, suffix, new Date().toISOString());
  appendVerification(repo, suffix, new Date().toISOString());

  const lifecycle = getRecentLifecycleIntents(5);
  const verification = getRecentVerificationIntents(5);

  assert.ok(lifecycle.every((item) => item.event_type === "proposal_lifecycle"));
  assert.ok(verification.every((item) => item.event_type === "verification_result"));
});

test("projections return newest records first and respect limit", () => {
  const repo = getOperationsIngestRepo();
  const base = Date.now();
  const older = new Date(base - 60_000).toISOString();
  const newer = new Date(base).toISOString();
  const suffixOld = `${base}-old`;
  const suffixNew = `${base}-new`;
  appendLifecycle(repo, suffixOld, older);
  appendLifecycle(repo, suffixNew, newer);

  const recent = getRecentLifecycleIntents(200);
  const newIndex = recent.findIndex((item) => item.event_id === `evt-lifecycle-${suffixNew}`);
  const oldIndex = recent.findIndex((item) => item.event_id === `evt-lifecycle-${suffixOld}`);
  assert.ok(newIndex >= 0);
  assert.ok(oldIndex >= 0);
  assert.ok(newIndex < oldIndex, "newer record should appear before older record");

  const top = getRecentLifecycleIntents(1);
  assert.equal(top.length, 1);
});
