import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("system landing copy avoids deferred-parity placeholder language", () => {
  const file = read("app/(app)/pulse/system/page.tsx");
  assert.doesNotMatch(file, /Planned parity wiring/i);
  assert.doesNotMatch(file, /Reserved for operational intelligence layer after system parity gap review/i);
  assert.match(file, /Read-only customer and growth telemetry surface\./);
  assert.match(file, /Read-only reliability pattern and intelligence telemetry surface\./);
});

test("legacy /system aliases remain redirect-only wrappers", () => {
  const legacyRoot = read("app/(app)/system/page.tsx");
  assert.match(legacyRoot, /redirect\("\/pulse\/system"\)/);

  const legacySubroute = read("app/(app)/system/customers/page.tsx");
  assert.match(legacySubroute, /redirect\("\/pulse\/system\/customers"\)/);
  assert.doesNotMatch(legacySubroute, /SystemLayoutShell/);
});
