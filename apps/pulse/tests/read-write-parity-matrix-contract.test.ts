import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type ParityRow = {
  route: string;
  write_actions: string[];
  status: "implemented" | "deferred" | "intentional_read_only";
  impact: "high" | "medium" | "low";
  owner: string;
  target_phase: string;
};

type ParityMatrix = {
  rows: ParityRow[];
};

function loadMatrix(): ParityMatrix {
  const root = path.resolve(process.cwd(), "..", "..");
  const raw = readFileSync(path.join(root, "docs", "pulse-read-write-parity-matrix.json"), "utf8");
  return JSON.parse(raw) as ParityMatrix;
}

test("read/write parity matrix rows are owner-tagged and phase-tagged", () => {
  const matrix = loadMatrix();
  assert.ok(matrix.rows.length > 0, "read/write parity matrix must not be empty");
  for (const row of matrix.rows) {
    assert.ok(row.route.startsWith("/"), `route must be absolute: ${row.route}`);
    assert.ok(row.owner.trim().length > 0, `owner missing for ${row.route}`);
    assert.ok(row.target_phase.trim().length > 0, `target phase missing for ${row.route}`);
  }
});

test("high-impact write routes are not left unresolved", () => {
  const matrix = loadMatrix();
  const unresolvedHighImpact = matrix.rows.filter(
    (row) => row.impact === "high" && row.status !== "implemented",
  );
  assert.deepEqual(
    unresolvedHighImpact,
    [],
    `high-impact write rows unresolved: ${unresolvedHighImpact.map((row) => row.route).join(", ")}`,
  );
});

