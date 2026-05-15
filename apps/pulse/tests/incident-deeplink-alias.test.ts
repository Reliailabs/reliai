import assert from "node:assert/strict";
import test from "node:test";

import { toIncidentOperationsAliasPath } from "@/lib/incident-deeplink-alias";

test("investigate alias maps to operations investigation tab", () => {
  assert.equal(
    toIncidentOperationsAliasPath("inc_123", "investigate"),
    "/operations/incidents/inc_123?tab=investigation",
  );
});

test("compare alias maps to operations compare tab", () => {
  assert.equal(
    toIncidentOperationsAliasPath("inc_123", "compare"),
    "/operations/incidents/inc_123?tab=compare",
  );
});

test("incident id is encoded in alias path", () => {
  assert.equal(
    toIncidentOperationsAliasPath("inc/123", "compare"),
    "/operations/incidents/inc%2F123?tab=compare",
  );
});
