import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DemoPage from "@/app/demo/page";

test("demo route renders deterministic scenario surface with contract sections", () => {
  const html = renderToStaticMarkup(<DemoPage />);

  assert.match(html, /Deterministic Demo Scenario/);
  assert.match(html, /AI refund policy violation containment/);
  assert.match(html, /demo-inc-refund-policy-001/);
  assert.match(html, /inc-demo-001/);
  assert.match(html, /trace-demo-001/);
  assert.match(html, /AREI movement/);
  assert.match(html, /Mitigation outcome/);
  assert.match(html, /Replay health: healthy/);
  assert.match(html, /Scenario health: healthy/);
  assert.match(html, /Operational conclusion blocked:/);
  assert.match(html, /replay not complete/);
});
