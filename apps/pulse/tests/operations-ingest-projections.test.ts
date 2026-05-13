import assert from "node:assert/strict";
import test from "node:test";

import { getOperationsIngestRepo } from "../lib/operations-ingest-repository";
import { getRecentLifecycleIntents, getRecentVerificationIntents } from "../lib/operations-ingest-projections";

test("projections return recently appended lifecycle and verification intents", () => {
  const repo = getOperationsIngestRepo();
  const suffix = Date.now().toString();

  repo.append({
    ingest_record_id: `ing-lifecycle-${suffix}`,
    accepted_at: new Date().toISOString(),
    event_fingerprint: `fp-lifecycle-${suffix}`,
    request_shape_hash: `shape-lifecycle-${suffix}`,
    event: {
      event_id: `evt-lifecycle-${suffix}`,
      idempotency_key: `idem-lifecycle-${suffix}`,
      event_type: "proposal_lifecycle",
      occurred_at: new Date().toISOString(),
      request_context: { organization_id: "org_test", project_id: "none", environment_id: "none" },
      actor: { actor_type: "system", actor_id: "test" },
      target: { target_type: "proposal", target_id: `proposal-${suffix}` },
      payload: {},
      evidence_refs: [{ label: "Test", href: "/operations" }],
    },
  });

  repo.append({
    ingest_record_id: `ing-verify-${suffix}`,
    accepted_at: new Date().toISOString(),
    event_fingerprint: `fp-verify-${suffix}`,
    request_shape_hash: `shape-verify-${suffix}`,
    event: {
      event_id: `evt-verify-${suffix}`,
      idempotency_key: `idem-verify-${suffix}`,
      event_type: "verification_result",
      occurred_at: new Date().toISOString(),
      request_context: { organization_id: "org_test", project_id: "none", environment_id: "none" },
      actor: { actor_type: "system", actor_id: "test" },
      target: { target_type: "verification", target_id: `verification-${suffix}` },
      payload: {},
      evidence_refs: [{ label: "Test", href: "/operations" }],
    },
  });

  const lifecycle = getRecentLifecycleIntents(50);
  const verification = getRecentVerificationIntents(50);

  assert.ok(lifecycle.some((item) => item.event_id === `evt-lifecycle-${suffix}`));
  assert.ok(verification.some((item) => item.event_id === `evt-verify-${suffix}`));
});
