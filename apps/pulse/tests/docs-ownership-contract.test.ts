import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type DocsOwnershipContract = {
  status: "active" | "closed";
  decision: {
    docs_route: string;
    pulse_surface: string;
    ownership: "implemented_in_pulse" | "intentionally_externalized" | "deferred_blocker";
    owner: string;
    target_phase: string;
    notes: string[];
  };
};

const ROOT = path.resolve(process.cwd(), "..", "..");

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

test("F5 contract: docs ownership decision is explicit and owner-complete", () => {
  const contract = JSON.parse(readRepoFile("docs/pulse-docs-ownership.json")) as DocsOwnershipContract;
  assert.equal(contract.status, "closed");
  assert.equal(contract.decision.docs_route, "/docs");
  assert.ok(contract.decision.owner.trim().length > 0);
  assert.ok(contract.decision.target_phase.trim().length > 0);
  assert.ok(contract.decision.notes.length > 0);
});

test("F5 contract: current docs ownership is externalized and pulse remains wrapper surface", () => {
  const contract = JSON.parse(readRepoFile("docs/pulse-docs-ownership.json")) as DocsOwnershipContract;
  const pulseDocsSurface = path.join(ROOT, contract.decision.pulse_surface);
  assert.equal(existsSync(pulseDocsSurface), true, "pulse docs surface must exist");
  assert.equal(contract.decision.ownership, "intentionally_externalized");

  const pulsePage = readRepoFile("apps/pulse/app/(marketing)/docs/page.tsx");
  assert.match(pulsePage, /DocsPage/);
});

test("F5 contract: parity gap register points to docs ownership artifact", () => {
  const gaps = JSON.parse(readRepoFile("docs/pulse-functional-parity-gaps.json")) as {
    gaps: Array<{ id: string; artifact: string; state: string }>;
  };
  const f5 = gaps.gaps.find((gap) => gap.id === "F5");
  assert.ok(f5, "F5 must exist");
  assert.equal(f5?.artifact, "docs/pulse-docs-ownership.json");
  assert.equal(f5?.state, "closed");
});
