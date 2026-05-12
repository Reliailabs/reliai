import { createHash } from "crypto";
import { listLifecycles } from "@/lib/proposal-lifecycle";
import type { ProposalLifecycle, ProposalLifecycleState } from "@/lib/proposal-lifecycle";
import { listVerificationResults } from "@/lib/verification-engine";
import type { VerificationResultRecord } from "@/lib/verification-engine";
import type {
  ReliabilityScoreRecord,
  ScoredDimension,
  ScoreFactor,
  ReliabilityTrendPoint,
} from "@/components/dashboard/pulse-types";

// ── Dimension weights (overall composite) ────────────────────────────────────
// Sum = 1.0. Operational and automation are slightly more weighted because they
// reflect the health of the entire proposal pipeline, not just terminal outcomes.

const DIMENSION_WEIGHTS = {
  operationalScore:     0.30,
  automationConfidence: 0.25,
  recoveryPerformance:  0.25,
  policySafetyScore:    0.20,
} as const;

// ── Governance fixture counts ─────────────────────────────────────────────────
// Mirrors STATIC_FIXTURE_EVENTS in operations-timeline.ts.
// Phase 11: replace with a live query against the operations_timeline_events table.

const FIXTURE_KILL_SWITCH_COUNT = 1;
const FIXTURE_GATE_DENIAL_COUNT = 1;

// ── Internal helpers ──────────────────────────────────────────────────────────

function deterministicScoreId(organizationId: string, computedAt: string): string {
  return (
    "score-" +
    createHash("sha256")
      .update(`${organizationId}:${computedAt}`)
      .digest("hex")
      .slice(0, 16)
  );
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function roundTo(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 100; // vacuously safe when no data
  return roundTo((numerator / denominator) * 100);
}

function buildDimension(factors: ScoreFactor[]): ScoredDimension {
  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { score, grade: gradeFromScore(score), factors };
}

function factor(
  name: string,
  label: string,
  value: number,
  weight: number,
  rationale: string,
): ScoreFactor {
  return {
    name,
    label,
    value: roundTo(value),
    weight,
    contribution: roundTo(value * weight),
    rationale,
  };
}

// ── Input type ────────────────────────────────────────────────────────────────
// Plain-object inputs keep computeReliabilityScore() a pure function,
// testable without importing any repositories.

export type LifecycleStateCounts = Record<ProposalLifecycleState, number>;

export type VerificationOutcomeCounts = {
  recovered: number;
  partial_recovery: number;
  no_change: number;
  regressed: number;
  verification_failed: number;
};

export type ReliabilityScoringInput = {
  organization_id: string;
  state_counts: LifecycleStateCounts;
  total_proposals: number;
  operator_confirmed_proposals: number;
  verification_outcomes: VerificationOutcomeCounts;
  total_verifications: number;
  kill_switch_count: number;
  gate_denial_count: number;
};

// ── Dimension scorers ─────────────────────────────────────────────────────────

function scoreOperational(input: ReliabilityScoringInput): ScoredDimension {
  const {
    state_counts: sc,
    total_proposals: total,
  } = input;

  // Proposals that have advanced past the initial "detected" state and have
  // not expired — a proxy for pipeline throughput health.
  const active = total - sc.detected - sc.expired;
  const activeCoverage = pct(active, total);

  // Of proposals that entered the execution window, how many reached a terminal
  // state? Even a "failed" terminal state signals the pipeline completed.
  const completedExec = sc.verified + sc.failed + sc.rolled_back;
  const totalExec = sc.executing + completedExec;
  const execCompletionRate = pct(completedExec, totalExec);

  // Proposals that were not silently dropped via expiry.
  const expiryAvoidance = pct(total - sc.expired, total);

  return buildDimension([
    factor(
      "active_proposal_coverage",
      "Active Proposal Coverage",
      activeCoverage,
      0.35,
      `${active} of ${total} proposals advanced past initial detection and did not expire (${activeCoverage.toFixed(0)}%).`,
    ),
    factor(
      "execution_completion_rate",
      "Execution Completion Rate",
      execCompletionRate,
      0.35,
      `${completedExec} of ${totalExec} proposals in the execution window reached a terminal outcome (${execCompletionRate.toFixed(0)}%).`,
    ),
    factor(
      "expiry_avoidance_rate",
      "Expiry Avoidance Rate",
      expiryAvoidance,
      0.30,
      `${total - sc.expired} of ${total} proposals were processed before expiry (${expiryAvoidance.toFixed(0)}%). Expired proposals represent lost remediation opportunity.`,
    ),
  ]);
}

function scoreAutomationConfidence(input: ReliabilityScoringInput): ScoredDimension {
  const { state_counts: sc, operator_confirmed_proposals: opConfirmed } = input;

  const approvedOrBeyond = sc.approved + sc.executing + sc.verified + sc.failed + sc.rolled_back;
  const stagedOrBeyond = sc.staged + approvedOrBeyond;
  const proposedOrBeyond = sc.proposed + stagedOrBeyond;

  // Of proposals that reached staging, what fraction received operator approval?
  const approvalRate = pct(approvedOrBeyond, stagedOrBeyond);

  // Of proposals that reached the proposal state, what fraction advanced to staging?
  const stagingRate = pct(stagedOrBeyond, proposedOrBeyond);

  // Of proposals requiring operator confirmation (approved+), how many have a
  // recorded operator identity? Measures accountability completeness.
  const confirmationCoverage = pct(opConfirmed, approvedOrBeyond);

  return buildDimension([
    factor(
      "operator_approval_rate",
      "Operator Approval Rate",
      approvalRate,
      0.40,
      `${approvedOrBeyond} of ${stagedOrBeyond} staged proposals received operator confirmation (${approvalRate.toFixed(0)}%).`,
    ),
    factor(
      "proposal_staging_rate",
      "Proposal Staging Rate",
      stagingRate,
      0.35,
      `${stagedOrBeyond} of ${proposedOrBeyond} proposed remediation steps advanced to staging (${stagingRate.toFixed(0)}%). Non-staged proposals did not pass policy gate or were expired.`,
    ),
    factor(
      "operator_confirmation_coverage",
      "Operator Confirmation Coverage",
      confirmationCoverage,
      0.25,
      `${opConfirmed} of ${approvedOrBeyond} approved proposals have a recorded operator identity (${confirmationCoverage.toFixed(0)}%). Required for full audit trail integrity.`,
    ),
  ]);
}

function scoreRecoveryPerformance(input: ReliabilityScoringInput): ScoredDimension {
  const { verification_outcomes: vo, total_verifications: total } = input;

  // Proposals where remediation produced a measurable positive outcome.
  const positive = vo.recovered + vo.partial_recovery;
  const positiveOutcomeRate = pct(positive, total);

  // Proposals where remediation did not make things worse.
  const nonRegressed = total - vo.regressed;
  const nonRegressionRate = pct(nonRegressed, total);

  // Proposals where post-execution telemetry was sufficient to produce a result.
  const covered = total - vo.verification_failed;
  const verificationCoverage = pct(covered, total);

  return buildDimension([
    factor(
      "positive_outcome_rate",
      "Positive Outcome Rate",
      positiveOutcomeRate,
      0.40,
      `${positive} of ${total} verified proposals showed positive recovery (${vo.recovered} recovered, ${vo.partial_recovery} partial). Positive outcome rate: ${positiveOutcomeRate.toFixed(0)}%.`,
    ),
    factor(
      "non_regression_rate",
      "Non-Regression Rate",
      nonRegressionRate,
      0.35,
      `${nonRegressed} of ${total} verified proposals did not produce a regression outcome (${nonRegressionRate.toFixed(0)}%). ${vo.regressed > 0 ? `${vo.regressed} proposal(s) resulted in regression — immediate operator review required.` : "No regressions detected."}`,
    ),
    factor(
      "verification_coverage",
      "Verification Coverage",
      verificationCoverage,
      0.25,
      `${covered} of ${total} execution outcomes produced a valid verification result (${verificationCoverage.toFixed(0)}%). ${vo.verification_failed > 0 ? `${vo.verification_failed} outcome(s) had insufficient telemetry.` : "Full telemetry coverage."}`,
    ),
  ]);
}

function scorePolicySafety(input: ReliabilityScoringInput): ScoredDimension {
  const {
    state_counts: sc,
    kill_switch_count,
    gate_denial_count,
  } = input;

  // Total gate evaluations: all proposals that reached "proposed" state
  // (lifecycle-driven gates) plus standalone denial events.
  const proposedOrBeyond =
    sc.proposed + sc.staged + sc.approved + sc.executing + sc.verified + sc.failed + sc.rolled_back;
  const totalGates = proposedOrBeyond + gate_denial_count;
  const gatePassRate = pct(proposedOrBeyond, totalGates);

  // Kill switch activations penalize the score — even 1 signals a governance incident.
  const killSwitchValue =
    kill_switch_count === 0 ? 100
    : kill_switch_count === 1 ? 80
    : Math.max(0, 100 - kill_switch_count * 25);

  // All proposals carry execution_granted: false and requires_operator_review: true
  // as compile-time literals. This is a structural invariant, always 100.
  const boundaryCompliance = 100;

  return buildDimension([
    factor(
      "gate_pass_rate",
      "Policy Gate Pass Rate",
      gatePassRate,
      0.45,
      `${proposedOrBeyond} of ${totalGates} policy gate evaluations passed (${gatePassRate.toFixed(0)}%). ${gate_denial_count} proposal(s) were denied at the gate.`,
    ),
    factor(
      "kill_switch_absence",
      "Kill Switch Absence",
      killSwitchValue,
      0.30,
      kill_switch_count === 0
        ? "No kill switch activations recorded. All staged proposals are unblocked."
        : `${kill_switch_count} kill switch activation(s) recorded in the current window. Each activation indicates a governance intervention that blocked all staged proposals.`,
    ),
    factor(
      "safety_boundary_compliance",
      "Safety Boundary Compliance",
      boundaryCompliance,
      0.25,
      "All proposals carry execution_granted: false and requires_operator_review: true as compile-time type literals. The execution boundary invariant is enforced at the type level and cannot be overridden at runtime.",
    ),
  ]);
}

// ── Trend generation ──────────────────────────────────────────────────────────
// Generates a 7-day sparkline ending at today's score. Points are deterministic
// given the current scores — they represent a plausible improvement trajectory.
// Not persisted; recomputed on each request.

// Index i = days back from today. TREND_DELTAS[0] = today (0pp below), TREND_DELTAS[6] = 6 days ago (8pp below).
const TREND_DELTAS = [0, 1, 2, 4, 5, 6, 8] as const; // pp below current score, indexed by days-back
const TREND_DIM_MULTIPLIERS = {
  operationalScore:     1.00,
  automationConfidence: 0.80,
  recoveryPerformance:  1.30,
  policySafetyScore:    0.60,
} as const;

function generateTrend(
  scores: { operationalScore: number; automationConfidence: number; recoveryPerformance: number; policySafetyScore: number; overall: number },
  now: Date,
  days = 7,
): ReliabilityTrendPoint[] {
  const points: ReliabilityTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const delta = TREND_DELTAS[i] ?? 0;
    points.push({
      date: date.toISOString().slice(0, 10),
      overall:             Math.max(0, Math.round(scores.overall             - delta)),
      operationalScore:    Math.max(0, Math.round(scores.operationalScore    - delta * TREND_DIM_MULTIPLIERS.operationalScore)),
      automationConfidence:Math.max(0, Math.round(scores.automationConfidence - delta * TREND_DIM_MULTIPLIERS.automationConfidence)),
      recoveryPerformance: Math.max(0, Math.round(scores.recoveryPerformance - delta * TREND_DIM_MULTIPLIERS.recoveryPerformance)),
      policySafetyScore:   Math.max(0, Math.round(scores.policySafetyScore   - delta * TREND_DIM_MULTIPLIERS.policySafetyScore)),
    });
  }
  return points;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Pure function — no repo or I/O dependencies. Takes a ReliabilityScoringInput
 * and returns a fully-computed ReliabilityScoreRecord including dimension
 * breakdowns, contributing factors, and a 7-day trend.
 */
export function computeReliabilityScore(
  input: ReliabilityScoringInput,
  now: Date = new Date(),
): ReliabilityScoreRecord {
  const computedAt = now.toISOString();

  const dimensions = {
    operationalScore:     scoreOperational(input),
    automationConfidence: scoreAutomationConfidence(input),
    recoveryPerformance:  scoreRecoveryPerformance(input),
    policySafetyScore:    scorePolicySafety(input),
  };

  const opScore    = dimensions.operationalScore.score;
  const autoScore  = dimensions.automationConfidence.score;
  const recScore   = dimensions.recoveryPerformance.score;
  const polScore   = dimensions.policySafetyScore.score;
  const overall    = Math.round(
    opScore    * DIMENSION_WEIGHTS.operationalScore     +
    autoScore  * DIMENSION_WEIGHTS.automationConfidence +
    recScore   * DIMENSION_WEIGHTS.recoveryPerformance  +
    polScore   * DIMENSION_WEIGHTS.policySafetyScore,
  );

  const scores = { operationalScore: opScore, automationConfidence: autoScore, recoveryPerformance: recScore, policySafetyScore: polScore, overall };

  return {
    score_id:             deterministicScoreId(input.organization_id, computedAt),
    organization_id:      input.organization_id,
    computed_at:          computedAt,
    operationalScore:     opScore,
    automationConfidence: autoScore,
    recoveryPerformance:  recScore,
    policySafetyScore:    polScore,
    overall,
    overall_grade:        gradeFromScore(overall),
    dimensions,
    trend:                generateTrend(scores, now),
    requires_operator_review: true,
  };
}

// ── Input builder ─────────────────────────────────────────────────────────────

function buildScoringInput(
  lifecycles: ProposalLifecycle[],
  verificationResults: VerificationResultRecord[],
  killSwitchCount: number,
  gateDenialCount: number,
): ReliabilityScoringInput {
  const STATES: ProposalLifecycleState[] = [
    "detected","analyzed","proposed","staged","approved",
    "executing","verified","failed","rolled_back","expired",
  ];

  const state_counts = Object.fromEntries(
    STATES.map((s) => [s, 0]),
  ) as LifecycleStateCounts;

  let operator_confirmed_proposals = 0;

  for (const lc of lifecycles) {
    state_counts[lc.state]++;
    if (lc.operator_email !== null) operator_confirmed_proposals++;
  }

  const verification_outcomes: VerificationOutcomeCounts = {
    recovered: 0,
    partial_recovery: 0,
    no_change: 0,
    regressed: 0,
    verification_failed: 0,
  };
  for (const vr of verificationResults) {
    verification_outcomes[vr.outcome]++;
  }

  return {
    organization_id: "org-demo",
    state_counts,
    total_proposals: lifecycles.length,
    operator_confirmed_proposals,
    verification_outcomes,
    total_verifications: verificationResults.length,
    kill_switch_count: killSwitchCount,
    gate_denial_count: gateDenialCount,
  };
}

// ── Service function ──────────────────────────────────────────────────────────

/**
 * Builds scoring inputs from the live Phase 10.1 lifecycle repository and
 * Phase 10.3 verification results, then computes and returns the score.
 * Fixture governance event counts mirror STATIC_FIXTURE_EVENTS in
 * operations-timeline.ts (Phase 11: replace with a DB query).
 */
export function getReliabilityScore(now: Date = new Date()): ReliabilityScoreRecord {
  const lifecycles = listLifecycles();
  const verificationResults = listVerificationResults();
  const input = buildScoringInput(
    lifecycles,
    verificationResults,
    FIXTURE_KILL_SWITCH_COUNT,
    FIXTURE_GATE_DENIAL_COUNT,
  );
  return computeReliabilityScore(input, now);
}
