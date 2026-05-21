import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type Decision = "implement" | "defer" | "intentional_exception";

type Row = {
  route: string;
  decision: Decision;
  owner: string;
  target_phase: string;
  reason: string;
};

type Contract = {
  version: number;
  scope: string;
  rows: Row[];
};

function loadContract(): Contract {
  const root = path.resolve(process.cwd(), "..", "..");
  const file = path.join(root, "docs", "pulse-system-surface-classification.json");
  return JSON.parse(readFileSync(file, "utf8")) as Contract;
}

test("system surface classification contract exists with complete ownership metadata", () => {
  const contract = loadContract();
  assert.equal(contract.version, 1);
  assert.ok(contract.scope.includes("apps/web -> apps/pulse"));
  assert.ok(contract.rows.length > 0);

  for (const row of contract.rows) {
    assert.ok(row.route.startsWith("/"), `route must be absolute: ${row.route}`);
    assert.ok(row.owner.trim().length > 0, `owner missing for route ${row.route}`);
    assert.ok(row.target_phase.trim().length > 0, `target_phase missing for route ${row.route}`);
    assert.ok(row.reason.trim().length > 0, `reason missing for route ${row.route}`);
  }
});

test("system routes are fully classified with no unowned entries", () => {
  const contract = loadContract();
  const expectedRoutes = new Set([
    "/pulse/system",
    "/pulse/system/platform",
    "/pulse/system/pipeline",
    "/pulse/system/extensions",
    "/pulse/system/customers",
    "/pulse/system/growth",
    "/pulse/system/expansion",
    "/pulse/system/reliability-patterns",
    "/pulse/system/intelligence",
    "/system",
  ]);

  const actualRoutes = new Set(contract.rows.map((row) => row.route));
  assert.deepEqual(actualRoutes, expectedRoutes);
});

test("system classification decisions are constrained to approved values", () => {
  const contract = loadContract();
  const allowed: Decision[] = ["implement", "defer", "intentional_exception"];

  for (const row of contract.rows) {
    assert.ok(allowed.includes(row.decision), `invalid decision for route ${row.route}: ${row.decision}`);
  }
});

test("system landing copy does not advertise deferred parity placeholders", () => {
  const file = readFileSync(
    path.join(process.cwd(), "app/(app)/pulse/system/page.tsx"),
    "utf8",
  );
  assert.doesNotMatch(file, /Planned parity wiring/i);
  assert.doesNotMatch(file, /Reserved for operational intelligence layer after system parity gap review/i);
});
