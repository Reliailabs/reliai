import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("project control route is owned by Pulse and redirects to canonical project reliability", () => {
  const file = read("app/(app)/projects/[projectId]/control/page.tsx");
  assert.match(file, /redirect\(`\/projects\/\$\{projectId\}\/reliability`\)/);
});

test("organization settings route is owned by Pulse and redirects to /settings", () => {
  const file = read("app/(app)/organization/settings/page.tsx");
  assert.match(file, /redirect\("\/settings"\)/);
});

test("model and prompt version routes are owned by Pulse and bridge to scoped traces", () => {
  const modelFile = read("app/(app)/model-versions/[id]/page.tsx");
  const promptFile = read("app/(app)/prompt-versions/[id]/page.tsx");

  assert.match(modelFile, /query\.set\("model_version_id", id\)/);
  assert.match(modelFile, /redirect\(`\/traces\?\$\{query\.toString\(\)\}`\)/);

  assert.match(promptFile, /query\.set\("prompt_version", id\)/);
  assert.match(promptFile, /redirect\(`\/traces\?\$\{query\.toString\(\)\}`\)/);
});

test("regression compare route is owned by Pulse and redirects to operations regression detail", () => {
  const file = read("app/(app)/regressions/[regressionId]/compare/page.tsx");
  assert.match(file, /redirect\(`\/operations\/regressions\/\$\{regressionId\}`\)/);
});

test("projects index route is owned by Pulse with explicit project listing surface", () => {
  const file = read("app/(app)/projects/page.tsx");
  assert.match(file, /AppShellFrame/);
  assert.match(file, /listProjectScopeOptions\(\)/);
  assert.match(file, /href=\{`\/projects\/\$\{project\.id\}`\}/);
});
