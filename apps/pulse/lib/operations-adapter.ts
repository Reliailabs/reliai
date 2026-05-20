/**
 * Phase 11.3 — FastAPI Adapter Boundary
 *
 * This module defines the typed adapter layer between the Next.js server and
 * the FastAPI backend for Operations Center data. It provides:
 *
 *   1. Backend API response types — typed shapes for what the FastAPI endpoints
 *      return (matching the Phase 11.2 Alembic schema columns).
 *   2. BackendOperationsTimelineRepository — calls the FastAPI API with
 *      graceful fallback semantics when endpoints or sessions are unavailable.
 *   3. BackendProposalLifecycleRepository — same for lifecycle data.
 *   4. Feature-flag factory functions — return the appropriate implementation
 *      based on RELIAI_OPERATIONS_DATA_MODE env var.
 *
 * Switching modes:
 *   RELIAI_OPERATIONS_DATA_MODE=fixture  → in-memory Phase 10 fixture data (default)
 *   RELIAI_OPERATIONS_DATA_MODE=live     → FastAPI backend via Bearer token
 *
 * FastAPI read routes for operations timeline/lifecycle are now wired. In live
 * mode, failures are surfaced via sourceErrors and callers fall back safely.
 */

import { API_URL } from "@/lib/constants";
import type {
  OperationsTimelineRepository,
  OperationsTimelineFilter,
} from "@/lib/operations-timeline";
import type {
  ProposalLifecycleRepository,
  ProposalLifecycle,
  LifecycleFilter,
  LifecycleStateHistoryEntry,
  ProposalLifecycleState,
} from "@/lib/proposal-lifecycle";
import type { OperationsTimelineEntry } from "@/components/dashboard/pulse-types";

// ── Adapter mode ──────────────────────────────────────────────────────────────

export type OperationsAdapterMode = "fixture" | "live";

export function getOperationsAdapterMode(): OperationsAdapterMode {
  const raw = process.env.RELIAI_OPERATIONS_DATA_MODE;
  return raw === "live" ? "live" : "fixture";
}

// ── Backend API response types ────────────────────────────────────────────────
// These types mirror the columns in the Phase 11.2 Alembic migration.
// FastAPI endpoints return these shapes; the adapter maps them to the
// TypeScript surface types consumed by the UI.

/**
 * GET /api/v1/operations/timeline
 * Query params: kind?, severity?, actor_type?, lifecycle_state?, incident_id?, proposal_id?
 */
type BackendTimelineEventRead = {
  readonly entry_id: string;
  readonly kind: string;
  readonly occurred_at: string;
  readonly organization_id: string;
  readonly project_id: string | null;
  readonly lifecycle_id: string | null;
  readonly proposal_id: string | null;
  readonly incident_id: string | null;
  readonly severity: string | null;
  readonly lifecycle_state: string | null;
  readonly actor_type: "human" | "system";
  readonly actor_label: string;
  readonly title: string;
  readonly summary: string;
  readonly policy_gate_result: "passed" | "denied" | null;
  readonly evidence_refs: Array<{ label: string; href: string }>;
  readonly requires_operator_review: true;
};

type BackendTimelineListResponse = {
  readonly items: BackendTimelineEventRead[];
  readonly total: number;
};

/**
 * GET /api/v1/operations/lifecycles
 * Query params: state?, organization_id?, proposal_id?
 *
 * GET /api/v1/operations/lifecycles/{lifecycle_id}
 */
type BackendLifecycleRead = {
  readonly lifecycle_id: string;
  readonly proposal_id: string;
  readonly action_type: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly organization_id: string;
  readonly project_id: string | null;
  readonly state: string;
  readonly execution_granted: false;
  readonly requires_operator_review: true;
  readonly operator_email: string | null;
  readonly verification_result_id: string | null;
  readonly audit_receipt_id: string | null;
  readonly failure_reason: string | null;
  readonly expires_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly state_history: Array<{
    from_state: string;
    to_state: string;
    transitioned_at: string;
    reason: string | null;
  }>;
};

type BackendLifecycleListResponse = {
  readonly items: BackendLifecycleRead[];
  readonly total: number;
};

// ── Shared fetch helper ───────────────────────────────────────────────────────

type BackendFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; notFound?: boolean };

/**
 * Callable that provides a Bearer token for backend requests.
 * The default implementation reads the session cookie via getApiAccessToken().
 * Tests can inject a stub: `new BackendOperationsTimelineRepository(async () => "test-token")`.
 */
export type TokenProvider = () => Promise<string | null>;

async function defaultTokenProvider(): Promise<string | null> {
  const auth = await import("@/lib/auth");
  return auth.getApiAccessToken();
}

async function backendGet<T>(
  path: string,
  tokenProvider: TokenProvider,
  options?: { allowNotFound?: boolean },
): Promise<BackendFetchResult<T>> {
  try {
    const token = await tokenProvider();
    if (!token) {
      return { ok: false, error: "missing session token" };
    }
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (response.status === 404) {
      if (options?.allowNotFound) {
        return { ok: false, error: `not found: ${path}`, notFound: true };
      }
      return {
        ok: false,
        error: `operations endpoint unavailable: ${path}`,
      };
    }
    if (!response.ok) {
      return { ok: false, error: `backend request failed: ${response.status} ${path}` };
    }
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `backend fetch error: ${message}` };
  }
}

// ── Backend timeline repository ───────────────────────────────────────────────

/**
 * Calls GET /api/v1/operations/timeline and maps the response to
 * OperationsTimelineEntry[]. Returns an empty array (+ logs source error) if
 * the endpoint is unavailable.
 *
 * @param tokenProvider — optional override for token acquisition; defaults to
 *   getApiAccessToken(). Pass a stub in tests to avoid calling next/headers.
 */
export class BackendOperationsTimelineRepository
  implements OperationsTimelineRepository
{
  private readonly sourceErrors: string[] = [];
  private readonly tokenProvider: TokenProvider;

  constructor(tokenProvider: TokenProvider = defaultTokenProvider) {
    this.tokenProvider = tokenProvider;
  }

  /** Returns and clears accumulated fetch errors since the last drain. */
  drainErrors(): string[] {
    return this.sourceErrors.splice(0);
  }

  findAll(filter?: OperationsTimelineFilter): OperationsTimelineEntry[] {
    // findAll must be synchronous to satisfy the OperationsTimelineRepository
    // interface. The real backend call happens in fetchAll(); callers that need
    // live data should use fetchAll() directly (see getOperationsSurfaceData).
    // This synchronous overload is a no-op stub for interface compatibility.
    void filter;
    return [];
  }

  async fetchAll(filter?: OperationsTimelineFilter): Promise<OperationsTimelineEntry[]> {
    const params = new URLSearchParams();
    if (filter?.kind) params.set("kind", filter.kind);
    if (filter?.project_id !== undefined) params.set("project_id", filter.project_id);
    if (filter?.severity) params.set("severity", filter.severity);
    if (filter?.actor_type) params.set("actor_type", filter.actor_type);
    if (filter?.lifecycle_state) params.set("lifecycle_state", filter.lifecycle_state);
    if (filter?.incident_id !== undefined) params.set("incident_id", filter.incident_id);
    if (filter?.proposal_id !== undefined) params.set("proposal_id", filter.proposal_id);

    const qs = params.toString();
    const path = `/api/v1/operations/timeline${qs ? `?${qs}` : ""}`;
    const result = await backendGet<BackendTimelineListResponse>(path, this.tokenProvider);

    if (!result.ok) {
      this.sourceErrors.push(result.error);
      return [];
    }

    return result.data.items.map(toTimelineEntry);
  }

  async fetchById(entryId: string): Promise<OperationsTimelineEntry | null> {
    const result = await backendGet<BackendTimelineEventRead>(
      `/api/v1/operations/timeline/${encodeURIComponent(entryId)}`,
      this.tokenProvider,
      { allowNotFound: true },
    );
    if (!result.ok) {
      if (result.notFound) {
        return null;
      }
      this.sourceErrors.push(result.error);
      return null;
    }
    return toTimelineEntry(result.data);
  }
}

function toTimelineEntry(r: BackendTimelineEventRead): OperationsTimelineEntry {
  return {
    entry_id: r.entry_id,
    kind: r.kind as OperationsTimelineEntry["kind"],
    occurred_at: r.occurred_at,
    organization_id: r.organization_id,
    project_id: r.project_id,
    lifecycle_id: r.lifecycle_id,
    proposal_id: r.proposal_id,
    incident_id: r.incident_id,
    severity: r.severity as OperationsTimelineEntry["severity"],
    lifecycle_state: r.lifecycle_state,
    actor_type: r.actor_type,
    actor_label: r.actor_label,
    title: r.title,
    summary: r.summary,
    policy_gate_result: r.policy_gate_result,
    evidence_refs: r.evidence_refs,
    requires_operator_review: true,
  };
}

// ── Backend lifecycle repository ──────────────────────────────────────────────

/**
 * Calls GET /api/v1/operations/lifecycles and GET /api/v1/operations/lifecycles/{id}.
 * Returns empty / null (+ logs source error) if endpoints are unavailable.
 *
 * @param tokenProvider — optional override for token acquisition (see BackendOperationsTimelineRepository).
 */
export class BackendProposalLifecycleRepository
  implements ProposalLifecycleRepository
{
  private readonly sourceErrors: string[] = [];
  private readonly tokenProvider: TokenProvider;

  constructor(tokenProvider: TokenProvider = defaultTokenProvider) {
    this.tokenProvider = tokenProvider;
  }

  drainErrors(): string[] {
    return this.sourceErrors.splice(0);
  }

  findById(lifecycleId: string): ProposalLifecycle | null {
    // Synchronous interface stub — use fetchById for async callers.
    void lifecycleId;
    return null;
  }

  findAll(_filter?: LifecycleFilter): ProposalLifecycle[] {
    // Synchronous interface stub — use fetchAll for async callers.
    return [];
  }

  save(lifecycle: ProposalLifecycle): ProposalLifecycle {
    // Phase 11.5: POST /api/v1/operations/lifecycles
    throw new Error(
      "BackendProposalLifecycleRepository.save is not yet implemented — Phase 11.5.",
    );
    return lifecycle; // unreachable; satisfies type
  }

  async fetchById(lifecycleId: string): Promise<ProposalLifecycle | null> {
    const result = await backendGet<BackendLifecycleRead>(
      `/api/v1/operations/lifecycles/${encodeURIComponent(lifecycleId)}`,
      this.tokenProvider,
      { allowNotFound: true },
    );
    if (!result.ok) {
      if (result.notFound) {
        return null;
      }
      this.sourceErrors.push(result.error);
      return null;
    }
    return toLifecycle(result.data);
  }

  async fetchAll(filter?: LifecycleFilter): Promise<ProposalLifecycle[]> {
    const params = new URLSearchParams();
    if (filter?.organization_id) params.set("organization_id", filter.organization_id);
    if (filter?.state) params.set("state", filter.state);
    if (filter?.proposal_id) params.set("proposal_id", filter.proposal_id);

    const qs = params.toString();
    const path = `/api/v1/operations/lifecycles${qs ? `?${qs}` : ""}`;
    const result = await backendGet<BackendLifecycleListResponse>(path, this.tokenProvider);

    if (!result.ok) {
      this.sourceErrors.push(result.error);
      return [];
    }

    return result.data.items.map(toLifecycle);
  }
}

function toLifecycle(r: BackendLifecycleRead): ProposalLifecycle {
  return {
    lifecycle_id: r.lifecycle_id,
    proposal_id: r.proposal_id,
    action_type: r.action_type,
    target_type: r.target_type,
    target_id: r.target_id,
    organization_id: r.organization_id,
    state: r.state as ProposalLifecycleState,
    execution_granted: false,
    requires_operator_review: true,
    operator_email: r.operator_email,
    verification_result_id: r.verification_result_id,
    failure_reason: r.failure_reason,
    expires_at: r.expires_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    state_history: r.state_history.map(
      (h): LifecycleStateHistoryEntry => ({
        from_state: h.from_state as ProposalLifecycleState,
        to_state: h.to_state as ProposalLifecycleState,
        transitioned_at: h.transitioned_at,
        reason: h.reason,
      }),
    ),
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the appropriate OperationsTimelineRepository for the current mode.
 * Pass the fixture repo as the default so the caller owns fixture construction.
 *
 * Usage in operations-timeline.ts:
 *   const repo = createTimelineRepo(getOperationsAdapterMode(), fixtureRepository);
 */
export function createTimelineRepo(
  mode: OperationsAdapterMode,
  fixtureRepo: OperationsTimelineRepository,
): OperationsTimelineRepository {
  return mode === "live" ? new BackendOperationsTimelineRepository() : fixtureRepo;
}

/**
 * Returns the appropriate ProposalLifecycleRepository for the current mode.
 */
export function createLifecycleRepo(
  mode: OperationsAdapterMode,
  fixtureRepo: ProposalLifecycleRepository,
): ProposalLifecycleRepository {
  return mode === "live" ? new BackendProposalLifecycleRepository() : fixtureRepo;
}
