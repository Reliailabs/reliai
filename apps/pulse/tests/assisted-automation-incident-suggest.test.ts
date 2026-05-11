import assert from "node:assert/strict";
import test from "node:test";

import { PHASE9_VALIDATOR_RESPONSE_CONTRACT } from "../app/api/actions/assisted-automation/_response";
import {
  buildIncidentSuggestions,
  validateIncidentSuggestionReview,
} from "../lib/assisted-automation";

const basePayload = {
  incident_id: "inc_abc123",
  severity: "high",
  status: "open",
  incident_type: "regression",
  project_name: "payments-api",
  evidence_refs: [
    { label: "Trace compare", href: "/traces/compare/abc" },
    { label: "Linked deployment", href: "/deployments#dep_1" },
  ],
  available_operators: ["alice@example.com", "bob@example.com"],
  signal_quality: {
    confidence: "medium",
    evidence_density: "medium",
  },
} as const;

test("valid request returns suggestion with all three fields", () => {
  const result = buildIncidentSuggestions(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.suggestion.draft_note.content.length > 0);
    assert.equal(result.suggestion.assignee_candidates.length, 2);
    assert.equal(typeof result.suggestion.escalation_recommendation.recommended, "boolean");
  }
});

test("suggestion is read-only — output contains no incident mutation fields", () => {
  const result = buildIncidentSuggestions(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    const s = result.suggestion as Record<string, unknown>;
    assert.equal(s["acknowledge"], undefined);
    assert.equal(s["assign"], undefined);
    assert.equal(s["status"], undefined);
    assert.equal(s["severity"], undefined);
    assert.equal(s["escalate"], undefined);
  }
});

test("proposal_id is deterministic and correctly prefixed", () => {
  const r1 = buildIncidentSuggestions(basePayload);
  const r2 = buildIncidentSuggestions(basePayload);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  if (r1.ok && r2.ok) {
    assert.equal(r1.suggestion.proposal_id, r2.suggestion.proposal_id);
    assert.match(r1.suggestion.proposal_id, /^phase9-inc-/);
  }
});

test("requires_operator_review is true on draft_note and escalation_recommendation", () => {
  const result = buildIncidentSuggestions(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestion.draft_note.requires_operator_review, true);
    assert.equal(result.suggestion.escalation_recommendation.requires_operator_review, true);
  }
});

test("draft_note cites all provided evidence_refs", () => {
  const result = buildIncidentSuggestions(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestion.draft_note.evidence_refs.length, 2);
    assert.deepEqual(result.suggestion.draft_note.evidence_refs, basePayload.evidence_refs);
  }
});

test("critical severity triggers escalation recommendation", () => {
  const result = buildIncidentSuggestions({ ...basePayload, severity: "critical" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestion.escalation_recommendation.recommended, true);
  }
});

test("high severity with insufficient confidence triggers escalation", () => {
  const result = buildIncidentSuggestions({
    ...basePayload,
    severity: "high",
    signal_quality: { confidence: "insufficient", evidence_density: "low" },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestion.escalation_recommendation.recommended, true);
  }
});

test("low severity does not trigger escalation", () => {
  const result = buildIncidentSuggestions({ ...basePayload, severity: "low" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestion.escalation_recommendation.recommended, false);
  }
});

test("empty available_operators returns empty candidates with warning", () => {
  const result = buildIncidentSuggestions({ ...basePayload, available_operators: [] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestion.assignee_candidates.length, 0);
    assert.ok(result.suggestion.warnings.some((w) => /no available operators/i.test(w)));
  }
});

test("assignee candidates preserve input order and are ranked from 1", () => {
  const result = buildIncidentSuggestions(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    const candidates = result.suggestion.assignee_candidates;
    assert.equal(candidates[0]?.operator_email, "alice@example.com");
    assert.equal(candidates[0]?.rank, 1);
    assert.equal(candidates[1]?.operator_email, "bob@example.com");
    assert.equal(candidates[1]?.rank, 2);
  }
});

test("external evidence href is rejected", () => {
  const result = buildIncidentSuggestions({
    ...basePayload,
    evidence_refs: [{ label: "External", href: "https://example.com" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("missing evidence_refs fails schema validation", () => {
  const { evidence_refs: _omit, ...rest } = basePayload;
  const result = buildIncidentSuggestions(rest);
  assert.equal(result.ok, false);
});

test("phase 9 envelope contract is preserved on suggestion response", () => {
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.contract_version, "phase9-v1");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.execution_granted, false);
});

// ── Review endpoint tests ─────────────────────────────────────────────────────

test("accepted review validates cleanly and returns logged:true", () => {
  const proposalId = "phase9-inc-abcdef1234567890";
  const result = validateIncidentSuggestionReview(proposalId, { decision: "accepted" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.proposal_id, proposalId);
    assert.equal(result.data.review_status, "accepted");
    assert.equal(result.data.logged, true);
  }
});

test("rejected review with reason validates cleanly", () => {
  const proposalId = "phase9-inc-abcdef1234567890";
  const result = validateIncidentSuggestionReview(proposalId, {
    decision: "rejected",
    reason: "Escalation not appropriate given current load",
    operator_email: "alice@example.com",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.review_status, "rejected");
    assert.equal(result.data.logged, true);
  }
});

test("rejected review without reason emits warning", () => {
  const proposalId = "phase9-inc-abcdef1234567890";
  const result = validateIncidentSuggestionReview(proposalId, { decision: "rejected" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /rejection reason/i.test(w)));
  }
});

test("invalid decision value is rejected", () => {
  const proposalId = "phase9-inc-abcdef1234567890";
  const result = validateIncidentSuggestionReview(proposalId, { decision: "maybe" });
  assert.equal(result.ok, false);
});

test("malformed proposal_id is rejected", () => {
  const result = validateIncidentSuggestionReview("bad-id", { decision: "accepted" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /proposal_id format invalid/);
  }
});

test("empty-suffix phase9-inc- prefix is rejected", () => {
  const result = validateIncidentSuggestionReview("phase9-inc-", { decision: "accepted" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /proposal_id format invalid/);
  }
});

test("draft_note evidence_refs are a copy, not a reference alias", () => {
  const result = buildIncidentSuggestions(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    const outputRefs = result.suggestion.draft_note.evidence_refs;
    assert.notEqual(outputRefs, basePayload.evidence_refs as unknown);
    assert.deepEqual(outputRefs, basePayload.evidence_refs);
  }
});
