import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type GapItem = {
  id: string;
  classification: "missing" | "read-only delta" | "ownership shift" | "intentional exception";
  impact: "high" | "medium" | "low";
  status: "resolved" | "pending" | "deferred" | "exception";
};

type GapContract = {
  version: number;
  items: GapItem[];
};

function loadContract(): GapContract {
  const root = path.resolve(process.cwd(), "..", "..");
  const file = path.join(root, "docs", "pulse-migration-parity-gaps.json");
  const raw = readFileSync(file, "utf8");
  return JSON.parse(raw) as GapContract;
}

test("migration parity contract: no unresolved high-impact gaps", () => {
  const contract = loadContract();
  assert.equal(contract.version, 1);
  assert.ok(contract.items.length > 0, "contract items must not be empty");

  const unresolvedHighImpact = contract.items.filter(
    (item) => item.impact === "high" && item.status !== "resolved",
  );

  assert.deepEqual(
    unresolvedHighImpact,
    [],
    `unresolved high-impact migration gaps found: ${unresolvedHighImpact.map((item) => item.id).join(", ")}`,
  );
});
