import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const MARKETING_FILES = [
  "components/marketing-linear/hero-section.tsx",
  "components/marketing-linear/ai-section.tsx",
  "components/marketing-linear/cta-section.tsx",
  "components/marketing-linear/pricing-page.tsx",
];

const BANNED_PHRASES = [
  "Explore the platform",
  "Operational demo preview",
  "View Pulse dashboard",
  "Pulse dashboard preview",
  "View Pulse capabilities",
];

test("marketing copy guard blocks regressed generic/pulse-leak phrases", () => {
  const combined = MARKETING_FILES.map(read).join("\n");

  for (const phrase of BANNED_PHRASES) {
    assert.doesNotMatch(combined, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("marketing copy guard preserves outcome-oriented demo CTA language", () => {
  const combined = MARKETING_FILES.map(read).join("\n");

  assert.match(combined, /Replay a production failure/);
  assert.match(combined, /Explore reliability evidence/);
  assert.match(combined, /Walk through mitigation response/);
});
