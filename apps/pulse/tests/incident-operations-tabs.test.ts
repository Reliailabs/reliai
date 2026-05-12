import assert from "node:assert/strict";
import test from "node:test";

import { resolveIncidentOperationsTab } from "../lib/incident-operations-tabs";

test("defaults to overview when tab is missing", () => {
  assert.equal(resolveIncidentOperationsTab(null), "overview");
});

test("returns valid tab unchanged", () => {
  assert.equal(resolveIncidentOperationsTab("timeline"), "timeline");
});

test("falls back to overview for invalid tab", () => {
  assert.equal(resolveIncidentOperationsTab("bad-tab"), "overview");
});
