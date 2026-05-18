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
  assert.match(html, /Evidence requirements:\s*6\/8 satisfied/);
  assert.match(html, /Blocking requirements:\s*2/);
});

test("demo surface shows replay-health block reason once replay is complete", () => {
  const html = renderToStaticMarkup(
    <DemoScenarioSurface
      fixture={buildFixture({ replayUnknown: true, scenarioUnknown: false, completedReplay: true })}
    />,
  );

  assert.match(html, /Operational conclusion blocked:/);
  assert.match(html, /replay integrity untrusted/);
  assert.match(html, /Evidence requirements:\s*7\/8 satisfied/);
  assert.match(html, /Blocking requirements:\s*1/);
});

test("demo surface shows combined health block reason once replay is complete", () => {
  const html = renderToStaticMarkup(
    <DemoScenarioSurface
      fixture={buildFixture({ replayUnknown: true, scenarioUnknown: true, completedReplay: true })}
    />,
  );

  assert.match(html, /Operational conclusion blocked:/);
  assert.match(html, /replay integrity untrusted, scenario integrity untrusted/);
  assert.match(html, /Evidence requirements:\s*6\/8 satisfied/);
  assert.match(html, /Blocking requirements:\s*2/);
});

test("demo surface renders mitigation outcome when replay is complete and health dimensions are trusted", () => {
  const fixture = buildFixture({
    replayUnknown: false,
    scenarioUnknown: false,
    completedReplay: true,
  });
  const html = renderToStaticMarkup(<DemoScenarioSurface fixture={fixture} />);

  const escapedOutcome = fixture.mitigation_outcome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(html, new RegExp(escapedOutcome));
  assert.doesNotMatch(html, /Operational conclusion blocked:/);
  assert.match(html, /Evidence requirements:\s*8\/8 satisfied/);
  assert.match(html, /Blocking requirements:\s*0/);
});

test("demo surface can allow degraded conclusion path when explicitly enabled", () => {
  const fixture = buildFixture({
    replayUnknown: false,
    scenarioUnknown: false,
    completedReplay: true,
  });
  fixture.replay_profile.stale = true;
  fixture.scenario_profile.stale_mitigation = true;

  const html = renderToStaticMarkup(
    <DemoScenarioSurface fixture={fixture} allowDegradedIntegrityConclusion />,
  );

  assert.match(html, /Conclusion confidence: degraded/);
  assert.doesNotMatch(html, /Operational conclusion blocked:/);
  assert.match(html, /Evidence requirements:\s*6\/8 satisfied/);
  assert.match(html, /Blocking requirements:\s*2/);
  const escapedOutcome = fixture.mitigation_outcome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(html, new RegExp(escapedOutcome));
});
