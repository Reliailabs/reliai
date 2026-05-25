import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

const INCIDENT_WRITE_ROUTES = [
  "app/api/incidents/[id]/acknowledge/route.ts",
  "app/api/incidents/[id]/resolve/route.ts",
  "app/api/incidents/[id]/reopen/route.ts",
];

test("incident lifecycle write routes require explicit POST intent and fail closed without auth", () => {
  for (const routePath of INCIDENT_WRITE_ROUTES) {
    const file = read(routePath);
    assert.match(file, /export async function POST\(/);
    assert.match(file, /const token = await getApiAccessToken\(\)/);
    assert.match(file, /if \(!token\) \{/);
    assert.match(file, /return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/);
    assert.match(file, /method: "POST"/);
    assert.match(file, /cache: "no-store"/);
  }
});

test("incident assignment write route requires explicit PATCH intent and fail-closed auth", () => {
  const file = read("app/api/incidents/[id]/assign/route.ts");
  assert.match(file, /export async function PATCH\(/);
  assert.match(file, /const token = await getApiAccessToken\(\)/);
  assert.match(file, /if \(!token\) \{/);
  assert.match(file, /return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(file, /method: "POST"/);
  assert.match(file, /owner_operator_user_id/);
  assert.match(file, /cache: "no-store"/);
});

test("incident write routes fail closed on degraded dependency behavior", () => {
  for (const routePath of [...INCIDENT_WRITE_ROUTES, "app/api/incidents/[id]/assign/route.ts"]) {
    const file = read(routePath);
    assert.match(file, /try \{/);
    assert.match(file, /catch \{/);
    assert.match(file, /status: 500/);
  }
});
