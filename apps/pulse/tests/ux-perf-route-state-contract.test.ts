import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function fileExists(relPath: string): boolean {
  return existsSync(path.join(process.cwd(), relPath));
}

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("critical post-migration surfaces provide loading and error route states", () => {
  const required = [
    "app/(app)/onboarding/loading.tsx",
    "app/(app)/onboarding/error.tsx",
    "app/(app)/settings/loading.tsx",
    "app/(app)/settings/error.tsx",
    "app/(app)/settings/billing/loading.tsx",
    "app/(app)/settings/billing/error.tsx",
  ];

  for (const relPath of required) {
    assert.equal(fileExists(relPath), true, `${relPath} missing`);
  }
});

test("error route states expose explicit retry affordance", () => {
  const errorFiles = [
    "app/(app)/onboarding/error.tsx",
    "app/(app)/settings/error.tsx",
    "app/(app)/settings/billing/error.tsx",
  ];

  for (const relPath of errorFiles) {
    const file = read(relPath);
    assert.match(file, /"use client"/);
    assert.match(file, /reset: \(\) => void/);
    assert.match(file, /onClick=\{reset\}/);
    assert.match(file, />\s*Retry\s*</);
  }
});
