import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type FunctionalGapItem = {
  id: string;
  classification: "functional continuity gap" | "deferred behavior delta" | "read/write delta" | "intentional exception";
  impact: "high" | "medium" | "low";
  status: "resolved" | "pending" | "deferred" | "exception";
  decision: "implement" | "defer" | "accept-exception";
  owner?: string;
  target_phase?: string;
};

type FunctionalGapContract = {
  version: number;
  items: FunctionalGapItem[];
};

function loadContract(): FunctionalGapContract {
  const root = path.resolve(process.cwd(), "..", "..");
  const file = path.join(root, "docs", "pulse-functional-parity-gaps.json");
  const raw = readFileSync(file, "utf8");
  return JSON.parse(raw) as FunctionalGapContract;
}

test("functional parity contract schema is complete and actionable", () => {
  const contract = loadContract();
  assert.equal(contract.version, 1);
  assert.ok(contract.items.length > 0, "functional parity items must not be empty");

  for (const item of contract.items) {
    assert.ok(item.id.length > 0, "item id is required");
    assert.ok(item.classification.length > 0, "classification is required");
    assert.ok(item.impact.length > 0, "impact is required");
    assert.ok(item.status.length > 0, "status is required");
    assert.ok(item.decision.length > 0, "decision is required");
    if (item.status !== "resolved") {
      assert.ok(item.owner && item.owner.length > 0, `${item.id} must declare owner while unresolved`);
      assert.ok(item.target_phase && item.target_phase.length > 0, `${item.id} must declare target_phase while unresolved`);
    }
  }
});

test("unresolved high-impact functional gaps must be explicitly owned", () => {
  const contract = loadContract();
  const unresolvedHigh = contract.items.filter((item) => item.impact === "high" && item.status !== "resolved");
  for (const item of unresolvedHigh) {
    assert.ok(item.owner, `${item.id} missing owner`);
    assert.ok(item.target_phase, `${item.id} missing target_phase`);
    assert.notEqual(item.decision, "accept-exception", `${item.id} cannot be high-impact exception without explicit downgrade`);
  }
});
