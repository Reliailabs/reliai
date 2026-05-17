import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("demo route ownership contract: /demo uses Pulse demo surface, not marketing clone", () => {
  const demoPage = read("app/demo/page.tsx");

  assert.match(demoPage, /DemoScenarioSurface/);
  assert.doesNotMatch(demoPage, /HeroSection|LogoCloud|FeatureCardsSection|CTASection|Footer/);
});

test("demo route ownership contract: no demo env bridge var in Pulse runtime", () => {
  const packageJson = read("package.json");
  const demoPage = read("app/demo/page.tsx");

  assert.doesNotMatch(packageJson, /NEXT_PUBLIC_RELIAI_DEMO_URL/);
  assert.doesNotMatch(demoPage, /NEXT_PUBLIC_RELIAI_DEMO_URL/);
});
