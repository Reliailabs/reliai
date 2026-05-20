import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "app/api/actions/operations");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(next));
      continue;
    }
    out.push(next);
  }
  return out;
}

test("phase13 validator route inventory is explicit and gate-owned", () => {
  const discovered = walk(ROOT)
    .filter((file) => file.endsWith(`${path.sep}validate${path.sep}route.ts`))
    .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
    .sort();

  const expected = [
    "ingest/validate/route.ts",
    "lifecycle/create/validate/route.ts",
    "lifecycle/transition/validate/route.ts",
    "verification/write/validate/route.ts",
  ].sort();

  assert.deepEqual(
    discovered,
    expected,
    [
      "Phase 13 validator route inventory changed.",
      "If this is intentional, update:",
      "- tests/operations-phase13-validator-route-inventory.test.ts",
      "- tests/operations-phase13-validator-route-boundary.test.ts",
      "- tests/operations-phase13-route-envelope-consistency.test.ts",
      "- docs/phase13-closure-gate.md",
    ].join("\n"),
  );
});
