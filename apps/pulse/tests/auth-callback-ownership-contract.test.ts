import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(process.cwd(), "..", "..");

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

test("F4 contract: pulse does not claim local /auth/callback ownership", () => {
  const pulseCallbackRoute = path.join(REPO_ROOT, "apps/pulse/app/auth/callback/route.ts");
  const webCallbackRoute = path.join(REPO_ROOT, "apps/web/app/auth/callback/route.ts");

  assert.equal(existsSync(pulseCallbackRoute), false, "pulse must not own /auth/callback while F4 is open");
  assert.equal(existsSync(webCallbackRoute), true, "web callback route must remain present while ownership is externalized");
});

test("F4 contract: auth callback ownership is explicitly documented as externalized", () => {
  const doc = readRepoFile("docs/pulse-auth-callback-ownership.md");
  assert.match(doc, /externalized to `apps\/web`/);
  assert.match(doc, /Status: open/);
  assert.match(doc, /must not introduce a local `\/auth\/callback` route/i);
});

test("F4 contract: parity gap register points to auth callback ownership artifact", () => {
  const register = JSON.parse(readRepoFile("docs/pulse-functional-parity-gaps.json")) as {
    gaps: Array<{ id: string; artifact: string; state: string }>;
  };
  const f4 = register.gaps.find((gap) => gap.id === "F4");
  assert.ok(f4, "F4 must exist in parity gap register");
  assert.equal(f4?.artifact, "docs/pulse-auth-callback-ownership.md");
  assert.equal(f4?.state, "open");
});
