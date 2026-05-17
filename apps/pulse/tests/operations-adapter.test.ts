/**
 * Phase 11.4 — Operations adapter tests.
 *
 * Tests three modes:
 *   1. Fixture mode  — getOperationsSurfaceData() with InMemoryOperationsTimelineRepository
 *   2. Backend mode success — BackendOperationsTimelineRepository.fetchAll() with mocked fetch
 *   3. Backend failure fallback — mocked fetch returning non-OK / throwing
 *
 * Run with:
 *   TSCONFIG_PATH=tsconfig.test.json node --import tsx --test \
 *     tests/operations-adapter.test.ts
 *
 * The tsconfig.test.json `paths` override maps `server-only` to a no-op stub
 * so that imports from `operations-adapter.ts` and `operations-timeline.ts`
 * succeed in the Node.js test runner.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendOperationsTimelineRepository,
  BackendProposalLifecycleRepository,
  type TokenProvider,
} from "../lib/operations-adapter";
import {
  getOperationsSurfaceData,
  InMemoryOperationsTimelineRepository,
} from "../lib/operations-timeline";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Token provider stub — avoids calling next/headers cookies() outside a request context. */
const TEST_TOKEN: TokenProvider = async () => "test-session-token";

/** Minimal valid BackendTimelineListResponse from GET /api/v1/operations/timeline */
function makeApiResponse(count: number = 2) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      entry_id: `otl-${String(i).padStart(16, "0")}`,
      kind: "incident_detected",
      occurred_at: "2026-05-12T09:00:00.000Z",
      organization_id: "org-test-uuid",
      project_id: null,
      lifecycle_id: null,
      proposal_id: null,
      incident_id: `inc-00${i}`,
      severity: null,
      lifecycle_state: null,
      actor_type: "system" as const,
      actor_label: "Reliai System",
      title: `Test event ${i}`,
      summary: "Test summary.",
      policy_gate_result: null,
      evidence_refs: [],
      requires_operator_review: true as const,
    })),
    total: count,
  };
}

function makeLifecycleListResponse(count: number = 2) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      lifecycle_id: `lifecycle-${String(i).padStart(16, "0")}`,
      proposal_id: `proposal-${i}`,
      action_type: "ack",
      target_type: "incident",
      target_id: `inc-00${i}`,
      organization_id: "org-test-uuid",
      project_id: null,
      state: "detected",
      execution_granted: false as const,
      requires_operator_review: true as const,
      operator_email: null,
      verification_result_id: null,
      audit_receipt_id: null,
      failure_reason: null,
      expires_at: "2026-05-20T00:00:00.000Z",
      created_at: "2026-05-12T09:00:00.000Z",
      updated_at: "2026-05-12T09:05:00.000Z",
      state_history: [],
    })),
    total: count,
  };
}

/**
 * Override globalThis.fetch for the duration of fn(), then restore it.
 * Returns whatever fn() returns.
 */
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

// ── Fixture mode ──────────────────────────────────────────────────────────────

test("fixture mode: getOperationsSurfaceData returns demo data and dataMode=demo", async () => {
  const fixtureRepo = new InMemoryOperationsTimelineRepository();
  const data = await getOperationsSurfaceData(fixtureRepo);

  assert.equal(data.dataMode, "demo");
  assert.ok(
    data.entries.length >= 1,
    `expected at least 1 fixture entry, got ${data.entries.length}`,
  );
  assert.deepEqual(data.sourceErrors, []);
});

test("fixture mode: entries are deterministic across two calls", async () => {
  const repo = new InMemoryOperationsTimelineRepository();
  const a = await getOperationsSurfaceData(repo);
  const b = await getOperationsSurfaceData(repo);

  assert.equal(a.entries.length, b.entries.length);
  assert.deepEqual(
    a.entries.map((e) => e.entry_id),
    b.entries.map((e) => e.entry_id),
  );
});

test("fixture mode: all fixture entries have requires_operator_review=true", async () => {
  const data = await getOperationsSurfaceData(new InMemoryOperationsTimelineRepository());
  for (const entry of data.entries) {
    assert.equal(
      entry.requires_operator_review,
      true,
      `entry ${entry.entry_id} has requires_operator_review !== true`,
    );
  }
});

test("fixture mode: injected reliability snapshot is used verbatim", async () => {
  const repo = new InMemoryOperationsTimelineRepository();
  const injected = {
    snapshot_id: "score-org-demo-injected",
    captured_at: "2026-05-16T00:00:00.000Z",
    organization_id: "org-demo",
    project_id: null,
    reliability_score: 77,
    verification_pass_rate: 0.7,
    verified_count: 7,
    failed_count: 2,
    rolled_back_count: 1,
    requires_operator_review: true as const,
    execution_granted: false as const,
  };

  const data = await getOperationsSurfaceData(repo, {
    getReliabilitySnapshot: () => injected,
  });

  assert.deepEqual(data.reliabilitySnapshot, injected);
});

test("fixture mode: thrown snapshot reader falls back to reliabilitySnapshot=null", async () => {
  const repo = new InMemoryOperationsTimelineRepository();
  const data = await getOperationsSurfaceData(repo, {
    getReliabilitySnapshot: () => {
      throw new Error("snapshot unavailable");
    },
  });

  assert.equal(data.reliabilitySnapshot, null);
});

test("fixture mode: snapshot fallback does not mutate timeline entries ordering/content", async () => {
  const repo = new InMemoryOperationsTimelineRepository();

  const baseline = await getOperationsSurfaceData(repo, {
    getReliabilitySnapshot: () => ({
      snapshot_id: "score-1",
      captured_at: "2026-05-16T00:00:00.000Z",
      organization_id: "org-demo",
      project_id: null,
      reliability_score: 65,
      verification_pass_rate: 0.6,
      verified_count: 6,
      failed_count: 3,
      rolled_back_count: 1,
      requires_operator_review: true,
      execution_granted: false,
    }),
  });
  const fallback = await getOperationsSurfaceData(repo, {
    getReliabilitySnapshot: () => {
      throw new Error("snapshot down");
    },
  });

  assert.deepEqual(
    baseline.entries.map((e) => e.entry_id),
    fallback.entries.map((e) => e.entry_id),
  );
  assert.deepEqual(
    baseline.entries.map((e) => e.occurred_at),
    fallback.entries.map((e) => e.occurred_at),
  );
});

// ── Backend mode: fetchAll success ────────────────────────────────────────────

test("backend mode success: fetchAll maps API response to OperationsTimelineEntry[]", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const apiResponse = makeApiResponse(2);

  const entries = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => apiResponse,
      }) as Response,
    () => repo.fetchAll(),
  );

  assert.equal(entries.length, 2);
  assert.equal(entries[0].entry_id, "otl-0000000000000000");
  assert.equal(entries[0].kind, "incident_detected");
  assert.equal(entries[0].actor_type, "system");
  assert.equal(entries[0].requires_operator_review, true);
  assert.equal(repo.drainErrors().length, 0);
});

test("backend mode success: getOperationsSurfaceData with backend repo sets dataMode=live", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const apiResponse = makeApiResponse(3);

  const data = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => apiResponse,
      }) as Response,
    () => getOperationsSurfaceData(repo),
  );

  assert.equal(data.dataMode, "live");
  assert.equal(data.entries.length, 3);
  assert.deepEqual(data.sourceErrors, []);
});

test("backend mode success: fetchAll passes filter params as query string", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  let capturedUrl = "";

  await withMockedFetch(
    async (url, _init) => {
      capturedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0 }),
      } as Response;
    },
    () => repo.fetchAll({ kind: "approval_recorded", incident_id: "inc-001" }),
  );

  assert.ok(capturedUrl.includes("kind=approval_recorded"), `URL missing kind param: ${capturedUrl}`);
  assert.ok(capturedUrl.includes("incident_id=inc-001"), `URL missing incident_id param: ${capturedUrl}`);
});

// ── Backend mode: failure fallback ────────────────────────────────────────────

test("backend failure: 404 returns empty entries and populates sourceErrors", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const entries = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: false,
        status: 404,
        json: async () => ({}),
      }) as Response,
    () => repo.fetchAll(),
  );

  assert.deepEqual(entries, []);
  const errors = repo.drainErrors();
  assert.equal(errors.length, 1);
  assert.ok(
    errors[0].includes("not yet implemented"),
    `expected 'not yet implemented' in error: ${errors[0]}`,
  );
});

test("backend failure: non-OK status returns empty entries and sourceErrors", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const entries = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response,
    () => repo.fetchAll(),
  );

  assert.deepEqual(entries, []);
  const errors = repo.drainErrors();
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("503"), `expected status code in error: ${errors[0]}`);
});

test("backend failure: network error returns empty entries and sourceErrors", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const entries = await withMockedFetch(
    async (_url, _init) => {
      throw new Error("ECONNREFUSED");
    },
    () => repo.fetchAll(),
  );

  assert.deepEqual(entries, []);
  const errors = repo.drainErrors();
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("ECONNREFUSED"), `expected error message: ${errors[0]}`);
});

test("backend failure: getOperationsSurfaceData with backend repo exposes sourceErrors in result", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const data = await withMockedFetch(
    async (_url, _init) => {
      throw new Error("backend down");
    },
    () => getOperationsSurfaceData(repo),
  );

  assert.equal(data.dataMode, "live");
  assert.deepEqual(data.entries, []);
  assert.equal(data.sourceErrors.length, 1);
  assert.ok(data.sourceErrors[0].includes("backend down"));
});

test("backend lifecycle repo success: fetchAll maps lifecycle list", async () => {
  const repo = new BackendProposalLifecycleRepository(TEST_TOKEN);
  const apiResponse = makeLifecycleListResponse(2);

  const lifecycles = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => apiResponse,
      }) as Response,
    () => repo.fetchAll(),
  );

  assert.equal(lifecycles.length, 2);
  assert.equal(lifecycles[0].lifecycle_id, "lifecycle-0000000000000000");
  assert.equal(lifecycles[0].requires_operator_review, true);
  assert.deepEqual(repo.drainErrors(), []);
});

test("backend timeline repo success: fetchById maps timeline payload", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const event = makeApiResponse(1).items[0];

  const found = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => event,
      }) as Response,
    () => repo.fetchById(event.entry_id),
  );

  assert.ok(found);
  assert.equal(found?.entry_id, event.entry_id);
  assert.equal(found?.kind, event.kind);
  assert.deepEqual(repo.drainErrors(), []);
});

test("backend timeline repo shape parity: fetchAll item and fetchById result have identical keys", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const event = makeApiResponse(1).items[0];

  const listEntries = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ items: [event], total: 1 }),
      }) as Response,
    () => repo.fetchAll(),
  );

  const detailEntry = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => event,
      }) as Response,
    () => repo.fetchById(event.entry_id),
  );

  assert.ok(detailEntry);
  assert.deepEqual(
    Object.keys(listEntries[0]).sort(),
    Object.keys(detailEntry!).sort(),
  );
});

test("backend timeline repo missing record: fetchById returns null without source error", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const found = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: false,
        status: 404,
        json: async () => ({}),
      }) as Response,
    () => repo.fetchById("otl-missing"),
  );

  assert.equal(found, null);
  assert.deepEqual(repo.drainErrors(), []);
});

test("backend timeline repo backend failure: fetchById returns null and records source error", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  const found = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response,
    () => repo.fetchById("otl-error"),
  );

  assert.equal(found, null);
  const errors = repo.drainErrors();
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("503"));
});

test("backend lifecycle repo success: fetchById maps lifecycle payload", async () => {
  const repo = new BackendProposalLifecycleRepository(TEST_TOKEN);
  const lifecycle = makeLifecycleListResponse(1).items[0];

  const found = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => lifecycle,
      }) as Response,
    () => repo.fetchById(lifecycle.lifecycle_id),
  );

  assert.ok(found);
  assert.equal(found?.lifecycle_id, lifecycle.lifecycle_id);
  assert.equal(found?.proposal_id, lifecycle.proposal_id);
  assert.deepEqual(repo.drainErrors(), []);
});

test("backend lifecycle repo shape parity: fetchAll item and fetchById result have identical keys", async () => {
  const repo = new BackendProposalLifecycleRepository(TEST_TOKEN);
  const lifecycle = makeLifecycleListResponse(1).items[0];

  const listItems = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ items: [lifecycle], total: 1 }),
      }) as Response,
    () => repo.fetchAll(),
  );

  const detailItem = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: true,
        status: 200,
        json: async () => lifecycle,
      }) as Response,
    () => repo.fetchById(lifecycle.lifecycle_id),
  );

  assert.ok(detailItem);
  assert.deepEqual(
    Object.keys(listItems[0]).sort(),
    Object.keys(detailItem!).sort(),
  );
});

test("backend lifecycle repo missing record: fetchById returns null without source error", async () => {
  const repo = new BackendProposalLifecycleRepository(TEST_TOKEN);

  const found = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: false,
        status: 404,
        json: async () => ({}),
      }) as Response,
    () => repo.fetchById("lifecycle-missing"),
  );

  assert.equal(found, null);
  assert.deepEqual(repo.drainErrors(), []);
});

test("backend lifecycle repo backend failure: fetchById returns null and records source error", async () => {
  const repo = new BackendProposalLifecycleRepository(TEST_TOKEN);

  const found = await withMockedFetch(
    async (_url, _init) =>
      ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response,
    () => repo.fetchById("lifecycle-error"),
  );

  assert.equal(found, null);
  const errors = repo.drainErrors();
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("503"));
});

// ── drainErrors clears the buffer ────────────────────────────────────────────

test("drainErrors is idempotent: second call returns empty after first drain", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);

  await withMockedFetch(
    async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response,
    () => repo.fetchAll(),
  );

  const first = repo.drainErrors();
  const second = repo.drainErrors();
  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
});

// ── sync findAll() stub ───────────────────────────────────────────────────────

test("BackendOperationsTimelineRepository.findAll() is a sync no-op returning []", () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const result = repo.findAll();
  assert.deepEqual(result, []);
});
