import assert from "node:assert/strict";
import test from "node:test";

import type { OperationsTimelineEntry } from "@/components/dashboard/pulse-types";
import type { OperationsIntentProjection } from "@/lib/operations-ingest-projections";
import {
  mapIntentProjectionsToTimelineEntries,
  mergeTimelineEntriesWithIntentProjections,
} from "@/lib/operations-intent-timeline-bridge";

function makeIntent(overrides: Partial<OperationsIntentProjection> = {}): OperationsIntentProjection {
  return {
    event_id: "evt-default",
    idempotency_key: "idem-default",
    accepted_at: "2026-05-15T10:00:00.000Z",
    organization_id: "org-demo",
    target_id: "target-1",
    action_type: "rollout",
    target_type: "service",
    proposal_id: "prop-1",
    lifecycle_id: "lc-1",
    outcome: null,
    ...overrides,
  };
}

function makeBaseEntry(overrides: Partial<OperationsTimelineEntry> = {}): OperationsTimelineEntry {
  return {
    entry_id: "base-1",
    kind: "incident_detected",
    occurred_at: "2026-05-15T09:00:00.000Z",
    organization_id: "org-demo",
    project_id: null,
    lifecycle_id: null,
    proposal_id: null,
    incident_id: null,
    severity: null,
    lifecycle_state: null,
    actor_type: "system",
    actor_label: "Reliai System",
    title: "Base",
    summary: "Base timeline entry",
    policy_gate_result: null,
    evidence_refs: [],
    requires_operator_review: true,
    ...overrides,
  };
}

test("maps lifecycle + verification projections into timeline entries", () => {
  const lifecycle = [
    makeIntent({ event_id: "evt-l1", accepted_at: "2026-05-15T10:00:00.000Z" }),
  ];
  const verification = [
    makeIntent({ event_id: "evt-v1", accepted_at: "2026-05-15T11:00:00.000Z", outcome: "passed" }),
  ];

  const entries = mapIntentProjectionsToTimelineEntries(lifecycle, verification);

  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.kind === "proposal_generated"));
  assert.ok(entries.some((e) => e.kind === "verification_result"));
});

test("dedupes mapped entries by deterministic entry_id", () => {
  const duplicateLifecycle = [
    makeIntent({ event_id: "evt-dup", accepted_at: "2026-05-15T10:00:00.000Z" }),
    makeIntent({ event_id: "evt-dup", accepted_at: "2026-05-15T10:30:00.000Z" }),
  ];

  const entries = mapIntentProjectionsToTimelineEntries(duplicateLifecycle, []);

  assert.equal(entries.length, 1);
});

test("maps verification outcome policy results correctly", () => {
  const verification = [
    makeIntent({ event_id: "evt-pass", outcome: "passed" }),
    makeIntent({ event_id: "evt-fail", outcome: "failed" }),
    makeIntent({ event_id: "evt-unk", outcome: null }),
  ];

  const entries = mapIntentProjectionsToTimelineEntries([], verification);

  const byId = new Map(entries.map((e) => [e.entry_id, e]));
  const passed = Array.from(byId.values()).find((e) => e.summary.includes("passed"));
  const failed = Array.from(byId.values()).find((e) => e.summary.includes("failed"));
  const unknown = Array.from(byId.values()).find((e) => e.summary.includes("unknown"));

  assert.equal(passed?.policy_gate_result, "passed");
  assert.equal(failed?.policy_gate_result, "denied");
  assert.equal(unknown?.policy_gate_result, null);
});

test("merges lifecycle + verification projections with base timeline and sorts deterministically", () => {
  const base = [
    makeBaseEntry({ entry_id: "base-old", occurred_at: "2026-05-15T08:00:00.000Z" }),
    makeBaseEntry({ entry_id: "base-new", occurred_at: "2026-05-15T12:00:00.000Z" }),
  ];

  const intentEntries = mapIntentProjectionsToTimelineEntries(
    [makeIntent({ event_id: "evt-l", accepted_at: "2026-05-15T10:00:00.000Z" })],
    [makeIntent({ event_id: "evt-v", accepted_at: "2026-05-15T11:00:00.000Z", outcome: "passed" })],
  );

  const merged = mergeTimelineEntriesWithIntentProjections(base, intentEntries);

  const times = merged.map((e) => e.occurred_at);
  assert.deepEqual(times, [...times].sort((a, b) => new Date(b).getTime() - new Date(a).getTime()));
  assert.equal(merged[0].entry_id, "base-new");
});

test("duplicate ingest replay resilience: repeated merge remains stable and deduped", () => {
  const base = [makeBaseEntry({ entry_id: "base-1", occurred_at: "2026-05-15T09:00:00.000Z" })];
  const intents = mapIntentProjectionsToTimelineEntries(
    [makeIntent({ event_id: "evt-replay", accepted_at: "2026-05-15T10:00:00.000Z" })],
    [],
  );

  const once = mergeTimelineEntriesWithIntentProjections(base, intents);
  const twice = mergeTimelineEntriesWithIntentProjections(once, intents);

  assert.equal(once.length, twice.length);
  assert.deepEqual(
    once.map((e) => e.entry_id),
    twice.map((e) => e.entry_id),
  );
});
