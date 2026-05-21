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
  assert.ok(contract.gaps.length >= 3, "expected functional parity gaps to be enumerated");
  contract.gaps.forEach((gap) => {
    assert.ok(gap.owner.trim().length > 0, `${gap.id} missing owner`);
    assert.ok(gap.target_phase.trim().length > 0, `${gap.id} missing target phase`);
  });
});

test("F2 is closed and high-impact items remain explicit", () => {
  const contract = loadContract();
  const f2 = contract.gaps.find((gap) => gap.id === "F2");
  assert.ok(f2, "F2 missing");
  assert.equal(f2.state, "closed");

  const highImpact = contract.gaps.filter((gap) => gap.impact === "high");
  assert.ok(highImpact.length > 0, "high-impact functional items must remain explicit");
});

