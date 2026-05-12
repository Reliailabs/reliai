/**
 * Phase 11.5 — Operations hardening tests (TypeScript / Pulse side).
 *
 * Scope:
 *   1. Write-path disabled — BackendOperationsTimelineRepository has no save/upsert methods.
 *   2. BackendLifecycleRepository (if it exists) has no save/upsert methods.
 *   3. OperationsTimelineRepository interface contract — only read methods present.
 *   4. Governance field invariants on fixture data — requires_operator_review always true.
 *   5. sourceErrors surface correctly when backend fails.
 *   6. dataMode reflects the repository type, not the error state.
 *
 * Run with:
 *   TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test \
 *     tests/operations-hardening.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendOperationsTimelineRepository,
  type TokenProvider,
} from "../lib/operations-adapter";
import {
  getOperationsSurfaceData,
  InMemoryOperationsTimelineRepository,
} from "../lib/operations-timeline";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_TOKEN: TokenProvider = async () => "test-session-token";

async function withMockedFetch<T>(
  mockImpl: typeof fetch,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

function makeFailing503(): typeof fetch {
  return async (_url, _init) =>
    ({ ok: false, status: 503, json: async () => ({}) }) as Response;
}

// ── Write-path disabled ───────────────────────────────────────────────────────

test("write-path: BackendOperationsTimelineRepository has no save method", () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  assert.equal(
    typeof (repo as unknown as Record<string, unknown>)["save"],
    "undefined",
    "BackendOperationsTimelineRepository must not expose a save() method",
  );
});

test("write-path: BackendOperationsTimelineRepository has no upsert method", () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  assert.equal(
    typeof (repo as unknown as Record<string, unknown>)["upsert"],
    "undefined",
    "BackendOperationsTimelineRepository must not expose an upsert() method",
  );
});

test("write-path: BackendOperationsTimelineRepository has no create method", () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  assert.equal(
    typeof (repo as unknown as Record<string, unknown>)["create"],
    "undefined",
    "BackendOperationsTimelineRepository must not expose a create() method",
  );
});

test("write-path: InMemoryOperationsTimelineRepository has no save method", () => {
  const repo = new InMemoryOperationsTimelineRepository();
  assert.equal(
    typeof (repo as unknown as Record<string, unknown>)["save"],
    "undefined",
    "InMemoryOperationsTimelineRepository must not expose a save() method",
  );
});

// ── Read-only interface shape ─────────────────────────────────────────────────

test("interface: BackendRepo exposes findAll (sync stub) and fetchAll (async)", () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  assert.equal(typeof repo.findAll, "function", "findAll must be present");
  assert.equal(typeof repo.fetchAll, "function", "fetchAll must be present");
});

test("interface: BackendRepo.findAll() returns [] synchronously without throwing", () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const result = repo.findAll();
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("interface: InMemoryRepo exposes findAll (sync) but not fetchAll", () => {
  const repo = new InMemoryOperationsTimelineRepository();
  assert.equal(typeof repo.findAll, "function", "findAll must be present");
  // InMemoryRepo is the fixture/demo implementation — it has no async fetchAll.
  // Only BackendOperationsTimelineRepository implements the async fetchAll path.
  assert.equal(
    typeof (repo as unknown as Record<string, unknown>)["fetchAll"],
    "undefined",
    "InMemoryRepo must not expose fetchAll — it is a sync fixture only",
  );
});

// ── Governance field invariants ───────────────────────────────────────────────

test("governance: all InMemory fixture entries have requires_operator_review=true", async () => {
  const data = await getOperationsSurfaceData(
    new InMemoryOperationsTimelineRepository(),
  );
  for (const entry of data.entries) {
    assert.equal(
      entry.requires_operator_review,
      true,
      `Fixture entry ${entry.entry_id} has requires_operator_review !== true`,
    );
  }
});

test("governance: backend entries from API response have requires_operator_review=true", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const apiResponse = {
    items: [
      {
        entry_id: "otl-hardening-001",
        kind: "proposal_generated",
        occurred_at: "2026-05-12T10:00:00.000Z",
        organization_id: "org-test",
        project_id: null,
        lifecycle_id: "lc-001",
        proposal_id: "prop-001",
        incident_id: null,
        severity: null,
        lifecycle_state: "proposed",
        actor_type: "system" as const,
        actor_label: "Reliai System",
        title: "Hardening test entry",
        summary: "Governance invariant check.",
        policy_gate_result: null,
        evidence_refs: [],
        requires_operator_review: true as const,
      },
    ],
    total: 1,
  };

  const entries = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => apiResponse,
      }) as Response,
    () => repo.fetchAll(),
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].requires_operator_review, true);
});

// ── sourceErrors + dataMode under failure ─────────────────────────────────────

test("fallback: sourceErrors populated when backend returns 503", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const data = await withMockedFetch(makeFailing503(), () =>
    getOperationsSurfaceData(repo),
  );

  assert.equal(
    data.sourceErrors.length >= 1,
    true,
    "sourceErrors must contain at least one entry on 503",
  );
  assert.ok(
    data.sourceErrors[0].includes("503"),
    `expected 503 in sourceErrors[0]: ${data.sourceErrors[0]}`,
  );
});

test("fallback: dataMode=live even when backend fails (mode reflects repo type, not health)", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const data = await withMockedFetch(makeFailing503(), () =>
    getOperationsSurfaceData(repo),
  );

  // dataMode=live means "this session is wired to the live backend."
  // It does NOT mean "live data was successfully retrieved."
  assert.equal(
    data.dataMode,
    "live",
    "dataMode must remain 'live' regardless of backend health",
  );
});

test("fallback: entries is [] when backend fails (no phantom data)", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const data = await withMockedFetch(makeFailing503(), () =>
    getOperationsSurfaceData(repo),
  );

  assert.deepEqual(data.entries, []);
});

test("fallback: drainErrors() clears buffer so second call is empty", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  await withMockedFetch(makeFailing503(), () => repo.fetchAll());

  const first = repo.drainErrors();
  const second = repo.drainErrors();

  assert.ok(first.length >= 1, "first drain must have errors");
  assert.deepEqual(second, [], "second drain must be empty");
});

// ── Idempotency: repeated fetchAll doesn't accumulate errors ─────────────────

test("idempotency: two successive failures produce one error per call (not cumulative)", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  await withMockedFetch(makeFailing503(), () => repo.fetchAll());
  const firstErrors = repo.drainErrors();

  await withMockedFetch(makeFailing503(), () => repo.fetchAll());
  const secondErrors = repo.drainErrors();

  assert.equal(
    firstErrors.length,
    1,
    "first call should produce exactly 1 error",
  );
  assert.equal(
    secondErrors.length,
    1,
    "second call should produce exactly 1 error (drain cleared the buffer)",
  );
});
