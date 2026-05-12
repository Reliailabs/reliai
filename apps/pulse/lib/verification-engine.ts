import { createHash } from "crypto";
import { z } from "zod";

// ── Classification thresholds ─────────────────────────────────────────────────
// These constants define the decision boundaries for outcome classification.
// All values are in percentage points (pp) unless noted.

const MINIMUM_REQUEST_COUNT = 50;         // below this → verification_failed (insufficient signal)
const SIGNIFICANT_IMPROVEMENT_PP = 5.0;  // error rate drop ≥ this → recovered
const PARTIAL_RECOVERY_PP = 1.0;          // error rate drop ≥ this but < SIGNIFICANT → partial_recovery
const SIGNIFICANT_DEGRADATION_PP = 2.0;  // error rate increase ≥ this → regressed
// Within ±NOISE_BAND_PP and not meeting above thresholds → no_change
const NOISE_BAND_PP = 1.0;

// ── Outcome type ──────────────────────────────────────────────────────────────

export type VerificationOutcome =
  | "recovered"
  | "partial_recovery"
  | "no_change"
  | "regressed"
  | "verification_failed";

// ── Input schemas (Zod) ───────────────────────────────────────────────────────

const traceMetricWindowSchema = z.object({
  window_start: z.string().min(1),
  window_end: z.string().min(1),
  request_count: z.number().int().min(0),
  error_rate_pct: z.number().min(0).max(100),
  p99_latency_ms: z.number().min(0),
  p50_latency_ms: z.number().min(0),
});

export type TraceMetricWindow = z.infer<typeof traceMetricWindowSchema>;

const regressionSignatureSchema = z.object({
  regression_id: z.string().min(1),
  detected_at: z.string().min(1),
  error_rate_delta_pp: z.number(), // pp above baseline at time of detection
  latency_regression_pct: z.number().min(0), // % latency increase vs baseline
});

export type RegressionSignature = z.infer<typeof regressionSignatureSchema>;

const incidentTrendSchema = z.object({
  incident_id: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  open_at: z.string().min(1),
  resolved_at: z.string().nullable(),
});

export type IncidentTrend = z.infer<typeof incidentTrendSchema>;

const verificationInputSchema = z.object({
  lifecycle_id: z.string().min(1),
  proposal_id: z.string().min(1),
  before_window: traceMetricWindowSchema,
  after_window: traceMetricWindowSchema,
  regression_signature: regressionSignatureSchema,
  incident_trend: incidentTrendSchema,
});

export type VerificationInput = z.infer<typeof verificationInputSchema>;

// ── Output types ──────────────────────────────────────────────────────────────

export type GateCheck = {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type VerificationResultRecord = {
  readonly result_id: string;        // "vr-" + 16-char sha256 hex
  readonly lifecycle_id: string;
  readonly proposal_id: string;
  readonly outcome: VerificationOutcome;
  readonly confidence: "low" | "medium" | "high";
  readonly rationale: string;
  readonly error_rate_before_pct: number;
  readonly error_rate_after_pct: number;
  readonly error_rate_delta_pp: number;  // after - before (negative = improvement)
  readonly latency_p99_before_ms: number;
  readonly latency_p99_after_ms: number;
  readonly latency_delta_pct: number;    // (after - before) / before * 100
  readonly gate_checks: GateCheck[];
  readonly computed_at: string;          // ISO 8601
  readonly requires_operator_review: true;
};

export type VerificationRunResult =
  | { ok: true; result: VerificationResultRecord; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

// ── Repository interface ──────────────────────────────────────────────────────
// Persistence-ready boundary. Phase 11: replace InMemoryVerificationResultRepository
// with a DB-backed implementation at the defaultRepository assignment below.

export interface VerificationResultRepository {
  findByLifecycleId(lifecycleId: string): VerificationResultRecord | null;
  findAll(): VerificationResultRecord[];
  save(record: VerificationResultRecord): VerificationResultRecord;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function deterministicResultId(proposalId: string, computedAt: string): string {
  return (
    "vr-" +
    createHash("sha256")
      .update(`${proposalId}:${computedAt}`)
      .digest("hex")
      .slice(0, 16)
  );
}

function computeLatencyDeltaPct(before: number, after: number): number {
  if (before === 0) return 0;
  return Math.round(((after - before) / before) * 100 * 10) / 10;
}

function classifyOutcome(
  input: VerificationInput,
): { outcome: VerificationOutcome; confidence: "low" | "medium" | "high"; rationale: string } {
  const { before_window, after_window } = input;

  // Insufficient telemetry signal
  if (after_window.request_count < MINIMUM_REQUEST_COUNT) {
    return {
      outcome: "verification_failed",
      confidence: "low",
      rationale: `After-window request count (${after_window.request_count}) is below the minimum threshold of ${MINIMUM_REQUEST_COUNT}. Telemetry is insufficient to determine verification outcome. Operator review required.`,
    };
  }

  const errorDelta = after_window.error_rate_pct - before_window.error_rate_pct;
  const improvementPP = -errorDelta; // positive = improvement

  if (improvementPP >= SIGNIFICANT_IMPROVEMENT_PP) {
    const confidence =
      after_window.request_count >= 500 ? "high"
      : after_window.request_count >= 200 ? "medium"
      : "low";
    return {
      outcome: "recovered",
      confidence,
      rationale: `Error rate dropped by ${improvementPP.toFixed(1)}pp (${before_window.error_rate_pct.toFixed(1)}% → ${after_window.error_rate_pct.toFixed(1)}%), exceeding the ${SIGNIFICANT_IMPROVEMENT_PP}pp recovery threshold. Incident trend: ${input.incident_trend.resolved_at ? "resolved" : "open"}.`,
    };
  }

  if (improvementPP >= PARTIAL_RECOVERY_PP) {
    return {
      outcome: "partial_recovery",
      confidence: "medium",
      rationale: `Error rate improved by ${improvementPP.toFixed(1)}pp (${before_window.error_rate_pct.toFixed(1)}% → ${after_window.error_rate_pct.toFixed(1)}%), indicating partial recovery. Full recovery threshold is ${SIGNIFICANT_IMPROVEMENT_PP}pp. Continued operator monitoring recommended.`,
    };
  }

  if (errorDelta >= SIGNIFICANT_DEGRADATION_PP) {
    return {
      outcome: "regressed",
      confidence: "high",
      rationale: `Error rate increased by ${errorDelta.toFixed(1)}pp (${before_window.error_rate_pct.toFixed(1)}% → ${after_window.error_rate_pct.toFixed(1)}%), exceeding the ${SIGNIFICANT_DEGRADATION_PP}pp degradation threshold. Immediate operator review required.`,
    };
  }

  return {
    outcome: "no_change",
    confidence: "medium",
    rationale: `Error rate delta of ${errorDelta >= 0 ? "+" : ""}${errorDelta.toFixed(1)}pp is within the noise band (±${NOISE_BAND_PP}pp). No statistically significant change observed after remediation. Continued monitoring recommended.`,
  };
}

function buildGateChecks(input: VerificationInput, outcome: VerificationOutcome): GateCheck[] {
  const { before_window, after_window } = input;
  const hasAdequateSample = after_window.request_count >= MINIMUM_REQUEST_COUNT;
  const noLatencyRegression = after_window.p99_latency_ms <= before_window.p99_latency_ms * 1.2;
  const incidentResolved = input.incident_trend.resolved_at !== null;
  const errorRateNotWorse = after_window.error_rate_pct <= before_window.error_rate_pct + NOISE_BAND_PP;

  return [
    {
      name: "adequate_telemetry_sample",
      passed: hasAdequateSample,
      detail: `After-window request count: ${after_window.request_count} (minimum: ${MINIMUM_REQUEST_COUNT})`,
    },
    {
      name: "no_latency_regression",
      passed: noLatencyRegression,
      detail: `p99 latency: ${before_window.p99_latency_ms}ms → ${after_window.p99_latency_ms}ms (20% tolerance)`,
    },
    {
      name: "incident_resolved",
      passed: incidentResolved,
      detail: incidentResolved
        ? `Incident ${input.incident_trend.incident_id} resolved at ${input.incident_trend.resolved_at}`
        : `Incident ${input.incident_trend.incident_id} remains open`,
    },
    {
      name: "error_rate_not_worse",
      passed: errorRateNotWorse,
      detail: `Error rate: ${before_window.error_rate_pct.toFixed(1)}% → ${after_window.error_rate_pct.toFixed(1)}% (noise band: ±${NOISE_BAND_PP}pp)`,
    },
    {
      name: "outcome_not_failure",
      passed: outcome !== "verification_failed" && outcome !== "regressed",
      detail: `Outcome classified as '${outcome}'`,
    },
  ];
}

// ── In-memory repository ──────────────────────────────────────────────────────

export class InMemoryVerificationResultRepository
  implements VerificationResultRepository
{
  private readonly store: Map<string, VerificationResultRecord>;

  constructor(seed: VerificationResultRecord[] = VERIFICATION_FIXTURES) {
    this.store = new Map(seed.map((r) => [r.lifecycle_id, r]));
  }

  findByLifecycleId(lifecycleId: string): VerificationResultRecord | null {
    return this.store.get(lifecycleId) ?? null;
  }

  findAll(): VerificationResultRecord[] {
    return Array.from(this.store.values());
  }

  save(record: VerificationResultRecord): VerificationResultRecord {
    const stored = { ...record };
    this.store.set(stored.lifecycle_id, stored);
    return { ...stored };
  }
}

// ── Fixture data ──────────────────────────────────────────────────────────────
// 5 deterministic scenarios covering all VerificationOutcome values.
//
// Lifecycle IDs are computed from the Phase 10.1 fixture formula:
//   deterministicLifecycleId(proposalId, createdAt) = "lifecycle-" + sha256(proposalId:createdAt).slice(0,16)
//
// Scenario → lifecycle state alignment:
//   recovered         → lifecycle-7e728a4e7e2d4f1a  (state: "verified",  proposal: phase9-inc-0708091011120007)
//   partial_recovery  → lifecycle-7cabcce-partial    (standalone demo fixture, no matched lifecycle)
//   no_change         → lifecycle-14faf95b97602667   (state: "executing", proposal: phase9-inc-f607080910110006)
//   regressed         → lifecycle-c84051b28a326d08   (state: "failed",   proposal: phase9-inc-08091011121300008)
//   verification_failed → standalone demo fixture    (telemetry unavailable)

const VERIFICATION_FIXTURES: VerificationResultRecord[] = [
  // ── Scenario 1: recovered ──────────────────────────────────────────────────
  {
    result_id: "vr-465f416ae1320835",
    lifecycle_id: "lifecycle-7e728a4e7e2d4f1a",
    proposal_id: "phase9-inc-0708091011120007",
    outcome: "recovered",
    confidence: "high",
    rationale:
      "Error rate dropped by 14.5pp (15.0% → 0.5%), exceeding the 5.0pp recovery threshold. Incident trend: resolved.",
    error_rate_before_pct: 15.0,
    error_rate_after_pct: 0.5,
    error_rate_delta_pp: -14.5,
    latency_p99_before_ms: 3200,
    latency_p99_after_ms: 310,
    latency_delta_pct: computeLatencyDeltaPct(3200, 310),
    gate_checks: [
      { name: "adequate_telemetry_sample", passed: true,  detail: "After-window request count: 1240 (minimum: 50)" },
      { name: "no_latency_regression",     passed: true,  detail: "p99 latency: 3200ms → 310ms (20% tolerance)" },
      { name: "incident_resolved",         passed: true,  detail: "Incident inc-007 resolved at 2026-05-10T13:28:00.000Z" },
      { name: "error_rate_not_worse",      passed: true,  detail: "Error rate: 15.0% → 0.5% (noise band: ±1.0pp)" },
      { name: "outcome_not_failure",       passed: true,  detail: "Outcome classified as 'recovered'" },
    ],
    computed_at: "2026-05-10T13:35:00.000Z",
    requires_operator_review: true,
  },

  // ── Scenario 2: partial_recovery ──────────────────────────────────────────
  {
    result_id: "vr-7cabcce0494fe7a2",
    lifecycle_id: "lifecycle-partial-demo-001",
    proposal_id: "phase9-vr-partial-0000001",
    outcome: "partial_recovery",
    confidence: "medium",
    rationale:
      "Error rate improved by 4.0pp (12.0% → 8.0%), indicating partial recovery. Full recovery threshold is 5.0pp. Continued operator monitoring recommended.",
    error_rate_before_pct: 12.0,
    error_rate_after_pct: 8.0,
    error_rate_delta_pp: -4.0,
    latency_p99_before_ms: 2800,
    latency_p99_after_ms: 2100,
    latency_delta_pct: computeLatencyDeltaPct(2800, 2100),
    gate_checks: [
      { name: "adequate_telemetry_sample", passed: true,  detail: "After-window request count: 380 (minimum: 50)" },
      { name: "no_latency_regression",     passed: true,  detail: "p99 latency: 2800ms → 2100ms (20% tolerance)" },
      { name: "incident_resolved",         passed: false, detail: "Incident inc-005 remains open" },
      { name: "error_rate_not_worse",      passed: true,  detail: "Error rate: 12.0% → 8.0% (noise band: ±1.0pp)" },
      { name: "outcome_not_failure",       passed: true,  detail: "Outcome classified as 'partial_recovery'" },
    ],
    computed_at: "2026-05-10T15:00:00.000Z",
    requires_operator_review: true,
  },

  // ── Scenario 3: no_change ─────────────────────────────────────────────────
  {
    result_id: "vr-0a79ad995ebf49b3",
    lifecycle_id: "lifecycle-14faf95b97602667",
    proposal_id: "phase9-inc-f607080910110006",
    outcome: "no_change",
    confidence: "medium",
    rationale:
      "Error rate delta of -0.2pp (3.0% → 2.8%) is within the noise band (±1.0pp). No statistically significant change observed after remediation. Continued monitoring recommended.",
    error_rate_before_pct: 3.0,
    error_rate_after_pct: 2.8,
    error_rate_delta_pp: -0.2,
    latency_p99_before_ms: 520,
    latency_p99_after_ms: 510,
    latency_delta_pct: computeLatencyDeltaPct(520, 510),
    gate_checks: [
      { name: "adequate_telemetry_sample", passed: true,  detail: "After-window request count: 620 (minimum: 50)" },
      { name: "no_latency_regression",     passed: true,  detail: "p99 latency: 520ms → 510ms (20% tolerance)" },
      { name: "incident_resolved",         passed: false, detail: "Incident inc-006 remains open" },
      { name: "error_rate_not_worse",      passed: true,  detail: "Error rate: 3.0% → 2.8% (noise band: ±1.0pp)" },
      { name: "outcome_not_failure",       passed: true,  detail: "Outcome classified as 'no_change'" },
    ],
    computed_at: "2026-05-10T11:05:00.000Z",
    requires_operator_review: true,
  },

  // ── Scenario 4: regressed ─────────────────────────────────────────────────
  {
    result_id: "vr-051e5b392c372ab2",
    lifecycle_id: "lifecycle-c84051b28a326d08",
    proposal_id: "phase9-inc-08091011121300008",
    outcome: "regressed",
    confidence: "high",
    rationale:
      "Error rate increased by 4.0pp (2.0% → 6.0%), exceeding the 2.0pp degradation threshold. Immediate operator review required.",
    error_rate_before_pct: 2.0,
    error_rate_after_pct: 6.0,
    error_rate_delta_pp: 4.0,
    latency_p99_before_ms: 280,
    latency_p99_after_ms: 950,
    latency_delta_pct: computeLatencyDeltaPct(280, 950),
    gate_checks: [
      { name: "adequate_telemetry_sample", passed: true,  detail: "After-window request count: 890 (minimum: 50)" },
      { name: "no_latency_regression",     passed: false, detail: "p99 latency: 280ms → 950ms (20% tolerance)" },
      { name: "incident_resolved",         passed: false, detail: "Incident inc-009 remains open" },
      { name: "error_rate_not_worse",      passed: false, detail: "Error rate: 2.0% → 6.0% (noise band: ±1.0pp)" },
      { name: "outcome_not_failure",       passed: false, detail: "Outcome classified as 'regressed'" },
    ],
    computed_at: "2026-05-11T09:05:00.000Z",
    requires_operator_review: true,
  },

  // ── Scenario 5: verification_failed (telemetry unavailable) ───────────────
  {
    result_id: "vr-b9aacf305b109e0e",
    lifecycle_id: "lifecycle-telemetry-fail-001",
    proposal_id: "phase9-vr-telemetry-fail-001",
    outcome: "verification_failed",
    confidence: "low",
    rationale:
      "After-window request count (12) is below the minimum threshold of 50. Telemetry is insufficient to determine verification outcome. Operator review required.",
    error_rate_before_pct: 8.5,
    error_rate_after_pct: 0.0,    // no signal — not meaningful
    error_rate_delta_pp: 0.0,
    latency_p99_before_ms: 1800,
    latency_p99_after_ms: 0,
    latency_delta_pct: 0,
    gate_checks: [
      { name: "adequate_telemetry_sample", passed: false, detail: "After-window request count: 12 (minimum: 50)" },
      { name: "no_latency_regression",     passed: false, detail: "Insufficient data for latency comparison" },
      { name: "incident_resolved",         passed: false, detail: "Incident inc-008 remains open" },
      { name: "error_rate_not_worse",      passed: false, detail: "Insufficient data for error rate comparison" },
      { name: "outcome_not_failure",       passed: false, detail: "Outcome classified as 'verification_failed'" },
    ],
    computed_at: "2026-05-11T06:00:00.000Z",
    requires_operator_review: true,
  },
];

// ── Module-level singleton ────────────────────────────────────────────────────
// Phase 11: replace with a DB-backed VerificationResultRepository implementation.
const defaultRepository = new InMemoryVerificationResultRepository();

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Validates the input payload, classifies the verification outcome, builds
 * gate checks, and persists a VerificationResultRecord.
 *
 * This function is read-only with respect to production systems — it reads
 * trace metric snapshots and produces a classification. No production mutations
 * are performed. execution_granted is not evaluated here.
 */
export function runVerification(
  payload: unknown,
  repo: VerificationResultRepository = defaultRepository,
  now: Date = new Date(),
): VerificationRunResult {
  const parsed = verificationInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      warnings: [],
    };
  }

  const input = parsed.data;
  const warnings: string[] = [];

  // Warn if before_window has low request count (low confidence baseline)
  if (input.before_window.request_count < MINIMUM_REQUEST_COUNT) {
    warnings.push(
      `before_window request count (${input.before_window.request_count}) is below minimum — baseline may be unreliable.`,
    );
  }

  const computedAt = now.toISOString();
  const { outcome, confidence, rationale } = classifyOutcome(input);

  const errorDelta =
    input.after_window.error_rate_pct - input.before_window.error_rate_pct;
  const latencyDelta = computeLatencyDeltaPct(
    input.before_window.p99_latency_ms,
    input.after_window.p99_latency_ms,
  );

  const record: VerificationResultRecord = {
    result_id: deterministicResultId(input.proposal_id, computedAt),
    lifecycle_id: input.lifecycle_id,
    proposal_id: input.proposal_id,
    outcome,
    confidence,
    rationale,
    error_rate_before_pct: input.before_window.error_rate_pct,
    error_rate_after_pct: input.after_window.error_rate_pct,
    error_rate_delta_pp: Math.round(errorDelta * 10) / 10,
    latency_p99_before_ms: input.before_window.p99_latency_ms,
    latency_p99_after_ms: input.after_window.p99_latency_ms,
    latency_delta_pct: latencyDelta,
    gate_checks: buildGateChecks(input, outcome),
    computed_at: computedAt,
    requires_operator_review: true,
  };

  const saved = repo.save(record);
  return { ok: true, result: saved, warnings };
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Returns the verification result for a given lifecycle, or null if none exists.
 * Used by the Operations Center to enrich verification_result timeline entries.
 */
export function getVerificationResultByLifecycleId(
  lifecycleId: string,
  repo: VerificationResultRepository = defaultRepository,
): VerificationResultRecord | null {
  return repo.findByLifecycleId(lifecycleId);
}

/**
 * Returns all verification results. Used by the Operations Center to build
 * standalone timeline entries for partial_recovery, no_change, and
 * verification_failed scenarios.
 */
export function listVerificationResults(
  repo: VerificationResultRepository = defaultRepository,
): VerificationResultRecord[] {
  return repo.findAll();
}
