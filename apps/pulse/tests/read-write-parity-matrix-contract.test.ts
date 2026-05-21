import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type CapabilityState = "implemented" | "deferred" | "n/a";

type MatrixRow = {
  route: string;
  impact: "high" | "medium" | "low";
  owner: string;
  target_phase: string;
  capabilities: {
    create: CapabilityState;
    edit: CapabilityState;
    approve: CapabilityState;
    execute: CapabilityState;
    rollback: CapabilityState;
  };
  notes: string;
};

type MatrixContract = {
  version: number;
  scope: string;
  rows: MatrixRow[];
};

function loadMatrix(): MatrixContract {
  const root = path.resolve(process.cwd(), "..", "..");
  const file = path.join(root, "docs", "pulse-read-write-parity-matrix.json");
  return JSON.parse(readFileSync(file, "utf8")) as MatrixContract;
}

test("read/write parity matrix exists with complete ownership metadata", () => {
  const matrix = loadMatrix();
  assert.equal(matrix.version, 1);
  assert.ok(matrix.scope.includes("apps/web -> apps/pulse"));
  assert.ok(matrix.rows.length > 0);

  for (const row of matrix.rows) {
    assert.ok(row.route.startsWith("/"), `route must be absolute: ${row.route}`);
    assert.ok(row.owner.trim().length > 0, `owner missing for route ${row.route}`);
    assert.ok(row.target_phase.trim().length > 0, `target phase missing for route ${row.route}`);
    assert.ok(row.notes.trim().length > 0, `notes missing for route ${row.route}`);
  }
});

test("high-impact write rows are owner-tagged and fully classified", () => {
  const matrix = loadMatrix();
  const highImpactRows = matrix.rows.filter((row) => row.impact === "high");
  assert.ok(highImpactRows.length > 0, "expected at least one high-impact row");

  for (const row of highImpactRows) {
    const values = Object.values(row.capabilities);
    for (const value of values) {
      assert.ok(["implemented", "deferred", "n/a"].includes(value), `invalid capability state '${value}' for ${row.route}`);
    }
  }
});

test("high-impact rows are not left unresolved without an owner", () => {
  const matrix = loadMatrix();
  const unresolved = matrix.rows.filter((row) => {
    if (row.impact !== "high") return false;
    const values = Object.values(row.capabilities);
    return values.includes("deferred") && row.owner.trim().length === 0;
  });

  assert.deepEqual(unresolved, []);
});
