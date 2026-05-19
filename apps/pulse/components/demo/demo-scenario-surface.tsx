"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  evaluateMitigationConclusionIntegrity,
  getOperationalDecisionEvidenceSummary,
  getOperationalDecisionOutcomeMessage,
  getReplayHealthLabel,
  getReplayHealthPolicy,
  getScenarioHealthLabel,
  getScenarioHealthPolicy,
} from "@/lib/demo-operational-integrity-contract";
import { createDemoScenarioReplayController } from "@/lib/demo-scenario-engine";
import { getDemoScenarioFixture, type DemoScenarioFixture } from "@/lib/demo-scenario-fixtures";

type DemoScenarioSurfaceProps = {
  fixture?: DemoScenarioFixture;
  allowDegradedIntegrityConclusion?: boolean;
};

export function DemoScenarioSurface({
  fixture: fixtureProp,
  allowDegradedIntegrityConclusion = false,
}: DemoScenarioSurfaceProps = {}) {
  const fixture = useMemo(
    () => fixtureProp ?? getDemoScenarioFixture(),
    [fixtureProp],
  );
  const replay = useMemo(
    () => createDemoScenarioReplayController(fixture),
    [fixture],
  );
  const [frame, setFrame] = useState(() => replay.current());

  const reliabilityDelta = frame.reliability_after_score - frame.reliability_before_score;
  const healthPolicy = getReplayHealthPolicy(frame.replay_health);
  const scenarioPolicy = getScenarioHealthPolicy(frame.scenario_health);
  const integrityInput = {
    replay_done: frame.done,
    replay_health: frame.replay_health,
    scenario_health: frame.scenario_health,
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
    allow_degraded_integrity_conclusion: allowDegradedIntegrityConclusion,
  };
  const conclusionDecision = evaluateMitigationConclusionIntegrity(integrityInput);
  const evidenceSummary = getOperationalDecisionEvidenceSummary(integrityInput);
  const blockMessages = evidenceSummary.blocking_reason_messages;
  const healthLabel = getReplayHealthLabel(frame.replay_health);
  const scenarioLabel = getScenarioHealthLabel(frame.scenario_health);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Deterministic Demo Scenario</p>
          <h1 className="text-3xl font-semibold">AI refund policy violation containment</h1>
          <p className="text-sm text-zinc-300">
            Replay state: step {frame.cursor}/{frame.total} {frame.done ? "· complete" : "· in progress"}
          </p>
          <p className="text-xs text-zinc-500">{healthLabel}</p>
          <p className="text-xs text-zinc-500">{scenarioLabel}</p>
          <div className="pt-3 flex flex-wrap gap-3">
            <Link
              href="/ai-reliability-audit"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
            >
              Run this reliability audit
            </Link>
            <Link
              href="/signup"
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900"
            >
              Get started with Reliai
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Incident timeline progression</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Incident {frame.incident_id} is <span className="font-medium">{frame.incident_status}</span>.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {Array.from({ length: frame.cursor }).map((_, i) => {
                const step = fixture.timeline[i];
                return (
                  <li key={step?.id ?? `evt-${i}`} className="rounded-md border border-zinc-800 px-3 py-2">
                    <p className="font-medium text-zinc-100">{step?.step}</p>
                    <p className="text-xs text-zinc-400">{step?.at}</p>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Trace and evidence chain</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-zinc-400">Scenario</dt>
                <dd>{frame.scenario_id}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Trace</dt>
                <dd>{frame.trace_id}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Current evidence event</dt>
                <dd>{frame.event_id ?? "pending"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-zinc-500">{healthPolicy.evidence_note}</p>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-200">AREI movement</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {frame.reliability_before_score} → {frame.reliability_after_score} ({reliabilityDelta >= 0 ? "+" : ""}
              {reliabilityDelta})
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Verification pass rate: {Math.round(frame.verification_pass_rate * 100)}%
            </p>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Mitigation outcome</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {getOperationalDecisionOutcomeMessage(conclusionDecision, fixture.mitigation_outcome)}
            </p>
            <p className="mt-2 text-xs text-zinc-500">{healthPolicy.mitigation_note}</p>
            <p className="mt-1 text-xs text-zinc-500">{scenarioPolicy.scenario_note}</p>
            {!conclusionDecision.decision_allowed ? (
              <p className="mt-1 text-xs text-amber-300">
                Operational conclusion blocked: {blockMessages.join(", ")}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">
              Evidence requirements: {evidenceSummary.satisfied_requirements}/
              {evidenceSummary.total_requirements} satisfied
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Blocking requirements: {evidenceSummary.blocking_requirements}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Conclusion confidence: {conclusionDecision.confidence_level}
            </p>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 md:col-span-2">
            <h2 className="text-sm font-medium text-zinc-200">Business impact and counterfactual</h2>
            <p className="mt-2 text-sm text-zinc-300">{fixture.business_impact.narrative}</p>
            <p className="mt-2 text-xs text-zinc-400">
              At-risk revenue: ${fixture.business_impact.at_risk_revenue_usd.toLocaleString()} · Impacted sessions:{" "}
              {fixture.business_impact.impacted_sessions}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Without Reliai: {fixture.without_reliai_outcome}
            </p>
          </article>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFrame(replay.next())}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Next step
          </button>
          <button
            type="button"
            onClick={() => setFrame(replay.reset())}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Reset replay
          </button>
        </div>
      </div>
    </main>
  );
}
