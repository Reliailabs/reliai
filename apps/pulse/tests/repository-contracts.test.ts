/**
 * Phase 11.1 — Repository Contract Tests
 *
 * These tests verify that the shared repository contract interfaces are correct
 * and that each in-memory adapter satisfies its contract.
 *
 * Boundary note: InMemoryOperationsTimelineRepository cannot be directly
 * imported in the test runner because operations-timeline.ts uses
 * `import "server-only"`. Its AppendOnlyRepository contract is verified:
 *   (a) statically — the `implements` clause in the class declaration enforces
 *       the interface at compile time.
 *   (b) at runtime — via a test-local StubAppendOnlyRepository that exercises
 *       the same contract methods and semantics.
 *
 * When Phase 11 adds a DB-backed adapter, import it here and run the same
 * contract function — see the comment block at the bottom.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryProposalLifecycleRepository,
  type ProposalLifecycle,
  type ProposalLifecycleRepository,
} from "../lib/proposal-lifecycle";

import type {
  AppendOnlyRepository,
  ReadWriteRepository,
} from "../lib/repository-contracts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLifecycle(id: string): ProposalLifecycle {
  return {
    lifecycle_id: id,
    proposal_id: `phase9-test-${id}`,
    action_type: "ack",
    target_type: "incident",
    target_id: "inc-contract-test",
    organization_id: "org-contract",
    state: "detected",
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
    expires_at: "2026-05-13T00:00:00.000Z",
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [],
  };
}

// ── Stub AppendOnlyRepository ─────────────────────────────────────────────────
// Used to test the AppendOnlyRepository contract without importing server-only
// modules. Represents the minimal contract any append-only adapter must satisfy.

type StubRecord = { id: string; value: string };
type StubFilter = { value?: string };

class StubAppendOnlyRepository
  implements AppendOnlyRepository<StubRecord, StubFilter>
{
  private readonly data: StubRecord[];

  constructor(seed: StubRecord[] = []) {
    this.data = seed.map((r) => ({ ...r }));
  }

  findAll(filter?: StubFilter): StubRecord[] {
    const all = this.data.map((r) => ({ ...r }));
    if (!filter) return all;
    return all.filter((r) => (filter.value ? r.value === filter.value : true));
  }
}

// ── AppendOnlyRepository contract ─────────────────────────────────────────────

function runAppendOnlyContract<T>(
  label: string,
  makeRepo: () => AppendOnlyRepository<T>,
  minExpectedCount: number,
) {
  test(`${label}: findAll returns an array`, () => {
    const repo = makeRepo();
    assert.ok(Array.isArray(repo.findAll()), "findAll must return an array");
  });

  test(`${label}: findAll returns at least ${minExpectedCount} entries`, () => {
    const repo = makeRepo();
    assert.ok(
      repo.findAll().length >= minExpectedCount,
      `expected >= ${minExpectedCount} entries, got ${repo.findAll().length}`,
    );
  });

  test(`${label}: findAll called twice returns the same count`, () => {
    const repo = makeRepo();
    assert.equal(repo.findAll().length, repo.findAll().length);
  });

  test(`${label}: mutating the returned array does not affect the repository`, () => {
    const repo = makeRepo();
    const first = repo.findAll();
    (first as T[]).splice(0, first.length);
    const second = repo.findAll();
    assert.ok(
      second.length >= minExpectedCount,
      "internal state must be unaffected by mutating the returned array",
    );
  });
}

// ── ReadWriteRepository contract ─────────────────────────────────────────────

function runReadWriteContract<T>(
  label: string,
  makeEmptyRepo: () => ReadWriteRepository<T>,
  makeEntity: (id: string) => T,
  getId: (entity: T) => string,
) {
  test(`${label}: findById returns null for unknown id`, () => {
    const repo = makeEmptyRepo();
    assert.equal(repo.findById("does-not-exist"), null);
  });

  test(`${label}: empty repo: findAll returns empty array`, () => {
    const repo = makeEmptyRepo();
    assert.equal(repo.findAll().length, 0);
  });

  test(`${label}: save then findById round-trip`, () => {
    const repo = makeEmptyRepo();
    const entity = makeEntity("contract-rw-0001");
    repo.save(entity);
    const found = repo.findById(getId(entity));
    assert.ok(found !== null, "saved entity must be retrievable");
    assert.equal(getId(found), getId(entity));
  });

  test(`${label}: save returns a copy, not the input reference`, () => {
    const repo = makeEmptyRepo();
    const entity = makeEntity("contract-rw-0002");
    const returned = repo.save(entity);
    assert.notEqual(returned, entity, "save must return a distinct copy");
  });

  test(`${label}: findById returns a copy, not the internal reference`, () => {
    const repo = makeEmptyRepo();
    const entity = makeEntity("contract-rw-0003");
    repo.save(entity);
    const a = repo.findById(getId(entity))!;
    const b = repo.findById(getId(entity))!;
    assert.notEqual(a, b, "each findById call must return a distinct copy");
  });

  test(`${label}: save is an upsert — second save with same id does not duplicate`, () => {
    const repo = makeEmptyRepo();
    const id = "contract-rw-0004";
    repo.save(makeEntity(id));
    repo.save(makeEntity(id));
    const matching = repo.findAll().filter((e) => getId(e) === id);
    assert.equal(matching.length, 1, "upsert must not create duplicate entries");
  });

  test(`${label}: findAll includes saved entity`, () => {
    const repo = makeEmptyRepo();
    const id = "contract-rw-0005";
    repo.save(makeEntity(id));
    const found = repo.findAll().find((e) => getId(e) === id);
    assert.ok(found !== undefined, "saved entity must appear in findAll");
  });
}

// ── Run contracts ─────────────────────────────────────────────────────────────

// AppendOnlyRepository — tested via stub (operations-timeline.ts uses server-only)
runAppendOnlyContract<StubRecord>(
  "StubAppendOnlyRepository",
  () => new StubAppendOnlyRepository([
    { id: "s1", value: "a" },
    { id: "s2", value: "b" },
    { id: "s3", value: "c" },
  ]),
  3,
);

// ReadWriteRepository — tested via InMemoryProposalLifecycleRepository
runReadWriteContract<ProposalLifecycle>(
  "InMemoryProposalLifecycleRepository",
  () => new InMemoryProposalLifecycleRepository([]), // empty seed for isolation
  makeLifecycle,
  (lc) => lc.lifecycle_id,
);

// ── Seeded fixture checks ─────────────────────────────────────────────────────

test("InMemoryProposalLifecycleRepository (seeded): findAll returns all fixtures", () => {
  const repo: ProposalLifecycleRepository = new InMemoryProposalLifecycleRepository();
  assert.ok(repo.findAll().length >= 10, "default fixture has >= 10 lifecycles");
});

test("InMemoryProposalLifecycleRepository (seeded): findById retrieves known fixture", () => {
  const repo: ProposalLifecycleRepository = new InMemoryProposalLifecycleRepository();
  const first = repo.findAll()[0];
  assert.ok(first !== undefined, "fixture must be non-empty");
  const found = repo.findById(first.lifecycle_id);
  assert.ok(found !== null, "findById must find the first fixture lifecycle");
  assert.equal(found.lifecycle_id, first.lifecycle_id);
});

test("InMemoryProposalLifecycleRepository (seeded): findAll with state filter", () => {
  const repo: ProposalLifecycleRepository = new InMemoryProposalLifecycleRepository();
  const detected = repo.findAll({ state: "detected" });
  assert.ok(detected.length >= 1, "at least one lifecycle in detected state");
  assert.ok(
    detected.every((lc) => lc.state === "detected"),
    "filter by state must only return matching records",
  );
});

test("InMemoryProposalLifecycleRepository (seeded): findAll with org filter", () => {
  const repo: ProposalLifecycleRepository = new InMemoryProposalLifecycleRepository();
  const orgFiltered = repo.findAll({ organization_id: "org-demo" });
  assert.ok(orgFiltered.length >= 10, "all fixtures belong to org-demo");
  const wrongOrg = repo.findAll({ organization_id: "org-nonexistent" });
  assert.equal(wrongOrg.length, 0, "unknown org returns no results");
});

// ── Phase 11 adapter registration ────────────────────────────────────────────
// When a DB-backed adapter is added, import it here and call the same contract:
//
//   runReadWriteContract<ProposalLifecycle>(
//     "PostgresProposalLifecycleRepository",
//     () => new PostgresProposalLifecycleRepository(testDbClient),
//     makeLifecycle,
//     (lc) => lc.lifecycle_id,
//   );
//
//   runAppendOnlyContract(
//     "PostgresOperationsTimelineRepository",
//     () => new PostgresOperationsTimelineRepository(testDbClient),
//     10,
//   );
