import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type FunctionalGap = {
  id: string;
  impact: "high" | "medium" | "low";
  state: "open" | "closed" | "deferred";
  owner: string;
  target_phase: string;
};

type FunctionalGapContract = {
  status: "active" | "closed";
  gaps: FunctionalGap[];
};

function loadContract(): FunctionalGapContract {
  const root = path.resolve(process.cwd(), "..", "..");
  const raw = readFileSync(path.join(root, "docs", "pulse-functional-parity-gaps.json"), "utf8");
  return JSON.parse(raw) as FunctionalGapContract;
}

test("functional parity gap contract is present and owner-complete", () => {
  const contract = loadContract();
  assert.equal(contract.status, "active");
  assert.ok(contract.gaps.length >= 6, "expected full parity blockers to be enumerated");
  contract.gaps.forEach((gap) => {
    assert.ok(gap.owner.trim().length > 0, `${gap.id} missing owner`);
    assert.ok(gap.target_phase.trim().length > 0, `${gap.id} missing target phase`);
  });
});

test("full parity blockers remain explicitly tracked with resolved F1 and open F2-F6", () => {
  const contract = loadContract();
  const expectedIds = new Set(["F1", "F2", "F3", "F4", "F5", "F6"]);
  const actualIds = new Set(contract.gaps.map((gap) => gap.id));
  expectedIds.forEach((id) => assert.ok(actualIds.has(id), `${id} missing`));
  const byId = new Map(contract.gaps.map((gap) => [gap.id, gap]));
  assert.equal(byId.get("F1")?.state, "closed", "F1 must be closed once billing parity is implemented");
  ["F2", "F3", "F4", "F5", "F6"].forEach((id) => {
    assert.equal(byId.get(id)?.state, "open", `${id} must remain open until resolved`);
  });

  const highImpact = contract.gaps.filter((gap) => gap.impact === "high");
  assert.ok(highImpact.length > 0, "high-impact functional items must remain explicit");
});
