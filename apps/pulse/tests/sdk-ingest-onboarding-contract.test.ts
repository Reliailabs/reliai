import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function repoRoot(): string {
  return path.resolve(process.cwd(), "..", "..");
}

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(repoRoot(), relPath), "utf8");
}

test("sdk/ingest onboarding uses canonical API key env var naming", () => {
  const webSdkInstall = readRepoFile("apps/web/components/marketing/sdk-install-section.tsx");
  const webOnboarding = readRepoFile("apps/web/app/(onboarding)/onboarding/page.tsx");
  const pulseOnboarding = readRepoFile("apps/pulse/app/(app)/onboarding/page.tsx");
  const webDemoData = readRepoFile("apps/web/lib/demoData.ts");

  [webSdkInstall, webOnboarding, pulseOnboarding, webDemoData].forEach((file, index) => {
    assert.ok(!file.includes("RELIAI_KEY"), `found legacy RELIAI_KEY in file index ${index}`);
  });
  assert.ok(webSdkInstall.includes("RELIAI_API_KEY"), "web SDK install example must use RELIAI_API_KEY");
  assert.ok(pulseOnboarding.includes("RELIAI_API_KEY"), "pulse onboarding guidance must use RELIAI_API_KEY");
});

test("onboarding ingest examples use canonical Authorization Bearer header", () => {
  const webOnboarding = readRepoFile("apps/web/app/(onboarding)/onboarding/page.tsx");
  const pulseOnboarding = readRepoFile("apps/pulse/app/(app)/onboarding/page.tsx");

  assert.ok(webOnboarding.includes('Authorization: Bearer ${apiKeyValue ?? "reliai_..."}'));
  assert.ok(pulseOnboarding.includes('Authorization: Bearer ${apiKeyValue ?? "reliai_..."}'));
});

test("x-api-key guidance is backward-compatibility only", () => {
  const webOnboarding = readRepoFile("apps/web/app/(onboarding)/onboarding/page.tsx");
  const pulseOnboarding = readRepoFile("apps/pulse/app/(app)/onboarding/page.tsx");

  assert.ok(webOnboarding.includes("Backward compatibility"));
  assert.ok(pulseOnboarding.includes("Backward compatibility"));
  assert.ok(webOnboarding.includes("x-api-key"));
  assert.ok(pulseOnboarding.includes("x-api-key"));
});
