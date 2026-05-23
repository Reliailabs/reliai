import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type BillingRouteContract = {
  path: string;
  pulse_behavior: "redirect:/settings" | "missing" | "full_billing_surface" | "checkout_route";
  web_behavior: "full_billing_surface" | "upgrade_success_surface" | "checkout_route";
};

type BillingOwnershipContract = {
  status: "active" | "closed";
  decision: {
    ownership: "implemented_in_pulse" | "intentionally_externalized" | "deferred_blocker";
    owner: string;
    target_phase: string;
    routes: BillingRouteContract[];
    acceptance: string[];
  };
};

const ROOT = path.resolve(process.cwd(), "..", "..");

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

function pulseRouteExists(relPath: string): boolean {
  return existsSync(path.join(ROOT, relPath));
}

test("F1 contract: billing ownership decision is explicit and owner-complete", () => {
  const contract = JSON.parse(readRepoFile("docs/pulse-billing-ownership.json")) as BillingOwnershipContract;
  assert.equal(contract.status, "active");
  assert.ok(contract.decision.owner.trim().length > 0);
  assert.ok(contract.decision.target_phase.trim().length > 0);
  assert.ok(contract.decision.acceptance.length > 0);
  assert.equal(contract.decision.ownership, "deferred_blocker");
});

test("F1 contract: pulse billing routes reflect declared deferred behavior", () => {
  const contract = JSON.parse(readRepoFile("docs/pulse-billing-ownership.json")) as BillingOwnershipContract;

  const settingsBilling = contract.decision.routes.find((route) => route.path === "/settings/billing");
  const billingSuccess = contract.decision.routes.find((route) => route.path === "/billing/success");
  const checkout = contract.decision.routes.find((route) => route.path === "/api/billing/checkout");

  assert.ok(settingsBilling);
  assert.ok(billingSuccess);
  assert.ok(checkout);

  assert.equal(settingsBilling?.pulse_behavior, "redirect:/settings");
  assert.equal(billingSuccess?.pulse_behavior, "redirect:/settings");
  assert.equal(checkout?.pulse_behavior, "missing");

  assert.equal(pulseRouteExists("apps/pulse/app/(app)/settings/billing/page.tsx"), true);
  assert.equal(pulseRouteExists("apps/pulse/app/(app)/billing/success/page.tsx"), true);
  assert.equal(pulseRouteExists("apps/pulse/app/api/billing/checkout/route.ts"), false);
});

test("F1 contract: parity gap register points to billing ownership artifact and remains open", () => {
  const gaps = JSON.parse(readRepoFile("docs/pulse-functional-parity-gaps.json")) as {
    gaps: Array<{ id: string; artifact: string; state: string }>;
  };
  const f1 = gaps.gaps.find((gap) => gap.id === "F1");
  assert.ok(f1, "F1 must exist");
  assert.equal(f1?.artifact, "docs/pulse-billing-ownership.json");
  assert.equal(f1?.state, "open");
});
