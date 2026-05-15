/**
 * Phase 11.1 — Repository Contract Interfaces
 *
 * Shared base interfaces for all Phase 10/11 repositories.
 * Every Phase 10 in-memory adapter implements one of these; every Phase 11
 * DB-backed adapter must implement the same interface to be a valid substitute.
 *
 * Hierarchy:
 *
 *   AppendOnlyRepository<T, F>  ─── findAll(filter?)
 *         ↑
 *   ReadRepository<T, F>        ─── + findById(id)
 *         ↑
 *   ReadWriteRepository<T, F>   ─── + save(entity)
 *
 * Adapters:
 *   OperationsTimelineRepository    → AppendOnlyRepository  (entries are immutable once written)
 *   ProposalLifecycleRepository     → ReadWriteRepository   (lifecycle state is mutated)
 *   VerificationResultRepository    → ReadWriteRepository   (Phase 10.5 — verification read-path parity)
 *   ReliabilityScoreRepository      → AppendOnlyRepository  (Phase 10.4 — score snapshots, read-only)
 *
 * Phase 11 invariant: replacing the in-memory adapter at the `defaultRepository`
 * assignment in any lib file must require zero changes to service functions or
 * callers — the only change is the concrete class passed as the default.
 */

// ── Base interfaces ───────────────────────────────────────────────────────────

/**
 * Read-only, append-only repository.
 * Records are written once and never mutated.
 * Used for audit / event streams where history must be preserved.
 */
export interface AppendOnlyRepository<TEntity, TFilter = undefined> {
  findAll(filter?: TFilter): TEntity[];
}

/**
 * Read repository with individual-record lookup.
 * Used when callers need to retrieve a specific record by its primary key.
 */
export interface ReadRepository<TEntity, TFilter = undefined>
  extends AppendOnlyRepository<TEntity, TFilter> {
  findById(id: string): TEntity | null;
}

/**
 * Full read/write repository.
 * `save` is an upsert: insert on first call, overwrite on subsequent calls
 * with the same primary key. Returns the stored copy (never the input reference).
 */
export interface ReadWriteRepository<TEntity, TFilter = undefined>
  extends ReadRepository<TEntity, TFilter> {
  save(entity: TEntity): TEntity;
}

// ── Adapter marker ────────────────────────────────────────────────────────────

/**
 * Nominal marker that makes a repository's swap-point explicit.
 * Phase 11 DB adapters should use this as their return type annotation in the
 * factory/DI layer so the swap-point is visible at a glance.
 *
 * Usage:
 *   const defaultRepository: RepositoryAdapter<ProposalLifecycleRepository> =
 *     new InMemoryProposalLifecycleRepository();
 */
export type RepositoryAdapter<TRepo> = TRepo;
