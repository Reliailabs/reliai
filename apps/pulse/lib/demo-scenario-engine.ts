import {
  type DemoScenarioFixture,
  getDemoScenarioFixture,
} from "./demo-scenario-fixtures";
import {
  deriveReplayHealth,
  deriveScenarioHealth,
} from "./demo-operational-integrity-contract";

export type DemoScenarioReplayFrame = {
  cursor: number;
  total: number;
  done: boolean;
  scenario_id: string;
  incident_id: string;
  trace_id: string;
  event_id: string | null;
  event_step: string | null;
  event_at: string | null;
  incident_status: DemoScenarioFixture["incident"]["status"];
  reliability_before_score: number;
  reliability_after_score: number;
  verification_pass_rate: number;
  replay_health: "healthy" | "stale" | "partial" | "unknown";
  scenario_health: "healthy" | "stale" | "partial" | "unknown";
};

export type DemoScenarioReplayController = {
  current: () => DemoScenarioReplayFrame;
  next: () => DemoScenarioReplayFrame;
  reset: () => DemoScenarioReplayFrame;
  seek: (cursor: number) => DemoScenarioReplayFrame;
};

function toFrame(
  fixture: DemoScenarioFixture,
  cursor: number,
): DemoScenarioReplayFrame {
  const total = fixture.timeline.length;
  const bounded = Math.max(0, Math.min(cursor, total));
  const event = bounded === 0 ? null : fixture.timeline[bounded - 1];

  const incident_status =
    bounded >= total ? "mitigated" : fixture.incident.status;

  const replay_health = deriveReplayHealth(fixture.replay_profile);
  const scenario_health = deriveScenarioHealth(fixture.scenario_profile);

  return {
    cursor: bounded,
    total,
    done: bounded >= total,
    scenario_id: fixture.scenario_id,
    incident_id: fixture.incident.id,
    trace_id: fixture.trace.id,
    event_id: event?.id ?? null,
    event_step: event?.step ?? null,
    event_at: event?.at ?? null,
    incident_status,
    reliability_before_score: fixture.reliability.before_score,
    reliability_after_score: fixture.reliability.after_score,
    verification_pass_rate: fixture.reliability.verification_pass_rate,
    replay_health,
    scenario_health,
  };
}

export function createDemoScenarioReplayController(
  fixture: DemoScenarioFixture = getDemoScenarioFixture(),
): DemoScenarioReplayController {
  let cursor = 0;

  return {
    current() {
      return toFrame(fixture, cursor);
    },
    next() {
      cursor = Math.min(cursor + 1, fixture.timeline.length);
      return toFrame(fixture, cursor);
    },
    reset() {
      cursor = 0;
      return toFrame(fixture, cursor);
    },
    seek(nextCursor) {
      cursor = Math.max(0, Math.min(nextCursor, fixture.timeline.length));
      return toFrame(fixture, cursor);
    },
  };
}
