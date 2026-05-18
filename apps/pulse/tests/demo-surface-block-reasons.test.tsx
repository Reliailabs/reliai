import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DemoScenarioSurface } from "@/components/demo/demo-scenario-surface";
import { getDemoScenarioFixture } from "@/lib/demo-scenario-fixtures";

function buildFixture(overrides: {
  replayUnknown?: boolean;
  scenarioUnknown?: boolean;
  completedReplay?: boolean;
}) {
  const base = getDemoScenarioFixture();
  return {
    ...base,
    replay_profile: {
      ...base.replay_profile,
      unknown_outcome: overrides.replayUnknown ?? false,
    },
    scenario_profile: {
      ...base.scenario_profile,
      unknown_outcome: overrides.scenarioUnknown ?? false,
    },
    timeline: overrides.completedReplay ? [] : base.timeline,
  };
}

test("demo surface prioritizes replay-not-complete block reason while replay is in progress", () => {
  const html = renderToStaticMarkup(
    <DemoScenarioSurface fixture={buildFixture({ replayUnknown: true, scenarioUnknown: false })} />,
  );

  assert.match(html, /Operational conclusion blocked:/);
  assert.match(html, /replay not complete/);
});

test("demo surface shows replay-health block reason once replay is complete", () => {
  const html = renderToStaticMarkup(
    <DemoScenarioSurface
      fixture={buildFixture({ replayUnknown: true, scenarioUnknown: false, completedReplay: true })}
    />,
  );

  assert.match(html, /Operational conclusion blocked:/);
  assert.match(html, /replay health not trustworthy/);
});

test("demo surface shows combined health block reason once replay is complete", () => {
  const html = renderToStaticMarkup(
    <DemoScenarioSurface
      fixture={buildFixture({ replayUnknown: true, scenarioUnknown: true, completedReplay: true })}
    />,
  );

  assert.match(html, /Operational conclusion blocked:/);
  assert.match(html, /both replay and scenario health are not trustworthy/);
});
