import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

const EMPTY_STATE_SURFACES = [
  "components/dashboard/content/incidents-content.tsx",
  "components/dashboard/content/deployments-content.tsx",
  "components/dashboard/content/audits-content.tsx",
  "components/dashboard/content/performance-content.tsx",
];

test("dashboard empty states use shared EmptyStateNotice surface", () => {
  for (const relPath of EMPTY_STATE_SURFACES) {
    const file = read(relPath);
    assert.match(file, /import \{ EmptyStateNotice \} from "@\/components\/dashboard\/content\/empty-state-notice"/);
    assert.match(file, /<EmptyStateNotice message="/);
  }
});

test("empty state helper preserves canonical card styling", () => {
  const helper = read("components/dashboard/content/empty-state-notice.tsx");
  assert.match(helper, /rounded-xl border border-border bg-card/);
  assert.match(helper, /text-sm text-muted-foreground/);
});
