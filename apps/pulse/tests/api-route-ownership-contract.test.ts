import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type Disposition = "implemented_in_pulse" | "intentionally_externalized" | "deferred_blocker";

type RouteOwnershipRow = {
  path: string;
  disposition: Disposition;
  impact: "high" | "medium" | "low";
  owner: string;
  target_phase: string;
};

type RouteOwnershipContract = {
  routes: RouteOwnershipRow[];
};

const ROOT = path.resolve(process.cwd(), "..", "..");
const CONTRACT_PATH = path.join(ROOT, "docs", "pulse-api-route-ownership.json");
const REQUIRED_F3_ROUTES = [
  "/api/billing/checkout",
  "/api/config/apply",
  "/api/config/undo",
  "/api/prompts/diff",
  "/api/system/limits",
] as const;

function loadContract(): RouteOwnershipContract {
  return JSON.parse(readFileSync(CONTRACT_PATH, "utf8")) as RouteOwnershipContract;
}

function pulseRouteFile(routePath: string): string {
  const stripped = routePath.replace(/^\/api\//, "");
  return path.join(ROOT, "apps", "pulse", "app", "api", stripped, "route.ts");
}

test("F3 contract: all required API routes are classified", () => {
  const contract = loadContract();
  const byPath = new Map(contract.routes.map((row) => [row.path, row]));

  for (const route of REQUIRED_F3_ROUTES) {
    assert.ok(byPath.has(route), `missing ownership classification for ${route}`);
  }
});

test("F3 contract: classified routes are owner-complete and phase-tagged", () => {
  const contract = loadContract();
  for (const row of contract.routes) {
    assert.ok(row.path.startsWith("/api/"), `invalid api route path: ${row.path}`);
    assert.ok(row.owner.trim().length > 0, `owner missing for ${row.path}`);
    assert.ok(row.target_phase.trim().length > 0, `target_phase missing for ${row.path}`);
  }
});

test("F3 contract: implemented_in_pulse disposition requires local route file", () => {
  const contract = loadContract();
  const implemented = contract.routes.filter((row) => row.disposition === "implemented_in_pulse");
  for (const row of implemented) {
    assert.equal(
      existsSync(pulseRouteFile(row.path)),
      true,
      `implemented_in_pulse route missing local file: ${row.path}`,
    );
  }
});

test("F3 contract: high-impact API routes cannot be unclassified", () => {
  const contract = loadContract();
  const high = contract.routes.filter((row) => row.impact === "high");
  assert.ok(high.length >= REQUIRED_F3_ROUTES.length, "expected high-impact F3 routes to remain explicit");
  for (const row of high) {
    assert.notEqual(row.disposition, undefined);
  }
});
