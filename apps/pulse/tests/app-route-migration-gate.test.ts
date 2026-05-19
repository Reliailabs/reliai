import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "../proxy";

const APP_ROOT = path.resolve(process.cwd(), "app");

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("gate: onboarding route is owned under (app) and legacy root route is absent", () => {
  assert.equal(existsSync(path.join(APP_ROOT, "(app)/onboarding/page.tsx")), true);
  assert.equal(existsSync(path.join(APP_ROOT, "onboarding/page.tsx")), false);
});

test("gate: authenticated onboarding page is shell-wrapped", () => {
  const file = read("app/(app)/onboarding/page.tsx");
  assert.match(file, /AppShellFrame/);
  assert.match(file, /<AppShellFrame[\s\S]*activeSection="overview"/);
});

test("gate: authenticated /pulse/system is shell-wrapped", () => {
  const file = read("app/(app)/pulse/system/layout.tsx");
  assert.match(file, /AppShellFrame/);
});

test("gate: anonymous /onboarding preserves return_to query", async () => {
  const req = new NextRequest("http://localhost:3005/onboarding?path=simulation&autostart=1");
  const res = await proxy(req);
  assert.equal(res.status, 307);
  const location = res.headers.get("location");
  assert.equal(location, "http://localhost:3005/sign-in?return_to=%2Fonboarding%3Fpath%3Dsimulation%26autostart%3D1");
});

test("gate: anonymous /system preserves return_to", async () => {
  const req = new NextRequest("http://localhost:3005/system");
  const res = await proxy(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("location"), "http://localhost:3005/sign-in?return_to=%2Fsystem");
});

test("gate: /system canonicalizes to /pulse/system", () => {
  const file = read("app/(app)/system/page.tsx");
  assert.match(file, /redirect\("\/pulse\/system"\)/);
});

test("gate: /signup is an explicit ownership shim route", () => {
  const file = read("app/signup/page.tsx");
  assert.match(file, /resolveSignupHref/);
  assert.match(file, /Continue to account setup/);
  assert.match(file, /href=\{href\}/);
});

test("gate: app-owned pages outside (app) are documented shims only", () => {
  const allowed = new Set([
    "app/(marketing)/page.tsx",
    "app/(marketing)/pricing/page.tsx",
    "app/(marketing)/docs/page.tsx",
    "app/(marketing)/ai-reliability-audit/page.tsx",
    "app/sign-in/page.tsx",
    "app/demo/page.tsx",
    "app/signup/page.tsx",
  ]);

  const allPageFiles = [
    ...readDirRecursive(path.join(process.cwd(), "app")),
  ].filter((file) => file.endsWith("/page.tsx") || file.endsWith("\\page.tsx"));

  const outsideGroup = allPageFiles
    .map((abs) => path.relative(process.cwd(), abs).replaceAll("\\", "/"))
    .filter((rel) => !rel.startsWith("app/(app)/") && !rel.startsWith("app/api/"));

  for (const file of outsideGroup) {
    assert.equal(allowed.has(file), true, `unexpected page route outside (app): ${file}`);
  }
});

function readDirRecursive(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readDirRecursive(full));
    } else {
      files.push(full);
    }
  }
  return files;
}
