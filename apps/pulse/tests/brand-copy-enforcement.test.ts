import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("onboarding surface uses Reliai/Reliability copy and avoids Pulse branding leakage", () => {
  const source = read("app/(app)/onboarding/page.tsx");

  assert.match(source, /onboarding from Reliai/);
  assert.match(source, /Onboarding ownership in Reliai/);
  assert.match(source, /Reliability Onboarding/);

  assert.doesNotMatch(source, /onboarding from Pulse/);
  assert.doesNotMatch(source, /Onboarding ownership in Pulse/);
  assert.doesNotMatch(source, /Pulse Onboarding/);
});

test("core reliability nav label uses Reliai for overview entry", () => {
  const source = read("components/dashboard/app-sidebar.tsx");

  assert.match(source, /\{\s*id:\s*"overview",\s*label:\s*"Reliai"/);
  assert.doesNotMatch(source, /\{\s*id:\s*"overview",\s*label:\s*"Pulse"/);
});
