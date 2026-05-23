import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(process.cwd(), "..", "..");

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

test("F4 contract: pulse provides explicit externalized callback shim", () => {
  const pulseCallbackRoute = path.join(REPO_ROOT, "apps/pulse/app/auth/callback/route.ts");
  const webCallbackRoute = path.join(REPO_ROOT, "apps/web/app/auth/callback/route.ts");

  assert.equal(existsSync(pulseCallbackRoute), true, "pulse must provide explicit callback shim route");
  assert.equal(existsSync(webCallbackRoute), true, "web callback route must remain present as externalized owner");
});

test("F4 contract: auth callback ownership is documented as externalized and closed", () => {
  const doc = readRepoFile("docs/pulse-auth-callback-ownership.md");
  assert.match(doc, /externalized to `apps\/web`/);
  assert.match(doc, /Status: closed/);
  assert.match(doc, /shim forwards callback query to configured external callback/i);
});

test("F4 contract: parity gap register points to auth callback ownership artifact", () => {
  const register = JSON.parse(readRepoFile("docs/pulse-functional-parity-gaps.json")) as {
    gaps: Array<{ id: string; artifact: string; state: string }>;
  };
  const f4 = register.gaps.find((gap) => gap.id === "F4");
  assert.ok(f4, "F4 must exist in parity gap register");
  assert.equal(f4?.artifact, "docs/pulse-auth-callback-ownership.md");
  assert.equal(f4?.state, "closed");
});
