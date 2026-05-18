"use client";

import { useMemo, useState } from "react";

import { createDemoScenarioReplayController } from "@/lib/demo-scenario-engine";
import { getDemoScenarioFixture } from "@/lib/demo-scenario-fixtures";

export function DemoScenarioSurface() {
  const replay = useMemo(() => createDemoScenarioReplayController(), []);
  const fixture = useMemo(() => getDemoScenarioFixture(), []);
  const [frame, setFrame] = useState(() => replay.current());

  const reliabilityDelta = frame.reliability_after_score - frame.reliability_before_score;
  const healthLabel =
    frame.replay_health === "healthy"
      ? "Replay health: healthy"
      : frame.replay_health === "stale"
        ? "Replay health: stale snapshot"
        : frame.replay_health === "partial"
          ? "Replay health: partial evidence"
          : "Replay health: unknown outcome";

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
              {frame.done ? fixture.mitigation_outcome : "Mitigation in progress."}
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
